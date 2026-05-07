import { Pool, PoolClient } from 'pg';
import format from 'pg-format';
import { AccessGuard, CrudAction } from './AccessGuard';
import { TransactionContext } from './TransactionContext';
import { getAppSession } from '@/lib/auth/session';

/**
 * Resolved session context from the Auth.js JWT.
 * Extracted once per request and threaded through AccessGuard + TransactionContext.
 */
export interface SessionContext {
  userId: string;
  tenantId: string;
  role: string;
  activeTeamId?: string;
}

async function resolveSessionContext(): Promise<SessionContext> {
  const session = await getAppSession();
  const user = session?.user as any;

  if (!user?.id) {
    throw new Error('Unauthorized: No active session. Please sign in.');
  }
  if (!user?.tenantId) {
    throw new Error('Forbidden: User is not associated with any tenant.');
  }

  return {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role ?? 'MEMBER',
    activeTeamId: user.activeTeamId,
  };
}

export class QueryLayer {
  /**
   * Executes a database query within a fully-secured transaction context.
   *
   * Automatically extracts userId, tenantId, and role from the active Auth.js session.
   * Then:
   *  1. Enforces Object-Level Security via AccessGuard (Application Layer).
   *  2. Injects session variables into the PostgreSQL transaction to activate RLS (DB Layer).
   */
  static async executeSecureQuery<T>(
    pool: Pool,
    objectName: string,
    action: CrudAction,
    callback: (client: PoolClient, ctx: SessionContext) => Promise<T>
  ): Promise<T> {
    // 1. Resolve session — single source of truth for the entire request
    const ctx = await resolveSessionContext();

    // 2. Enforce Object-Level Security via AccessGuard
    await AccessGuard.checkPermission(objectName, action, {
      userId: ctx.userId,
      jwtRole: ctx.role,
    });

    // 3. Enforce Record-Level Security via TransactionContext (DB-level RLS)
    return TransactionContext.executeWithUserContext(
      pool,
      (client) => callback(client, ctx),
      {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        role: ctx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: ctx.activeTeamId
      }
    );
  }

  /**
   * Inserts a record securely. Automatically resolves session context.
   * Captures the action in the Audit Log within the same atomic transaction.
   */
  static async insertRecord(
    pool: Pool,
    schemaName: string,
    tableName: string,
    payload: Record<string, any>
  ): Promise<any> {
    const ctx = await resolveSessionContext();

    await AccessGuard.checkPermission(tableName, 'create', {
      userId: ctx.userId,
      jwtRole: ctx.role,
    });

    return TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        // 1. Add standard audit columns
        const dataToInsert = { 
          ...payload, 
          owner_id: ctx.userId, 
          owner_team_id: ctx.activeTeamId,
          created_by: ctx.userId, 
          updated_by: ctx.userId 
        };
        const columns = Object.keys(dataToInsert);
        const values = Object.values(dataToInsert);

        // 2. Execute dynamic INSERT
        const insertSql = format(
          'INSERT INTO %I.%I (%I) VALUES (%L) RETURNING *',
          schemaName,
          tableName,
          columns,
          values
        );
        const result = await client.query(insertSql);
        const newRecord = result.rows[0];

        // 3. Write Audit Log in the SAME pg transaction (atomic)
        const auditSql = format(
          `INSERT INTO core.audit_logs (id, tenant_id, user_id, action, object_name, record_id, new_values) 
           VALUES (gen_random_uuid(), %L, %L, 'CREATE', %L, %L, %L)`,
          ctx.tenantId,
          ctx.userId,
          tableName,
          newRecord.id,
          JSON.stringify(newRecord)
        );
        await client.query(auditSql);

        return newRecord;
      },
      { 
        userId: ctx.userId, 
        tenantId: ctx.tenantId, 
        role: ctx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: ctx.activeTeamId
      }
    );
  }

  /**
   * Updates a record securely. Automatically resolves session context.
   * Captures before/after states in the Audit Log within the same atomic transaction.
   */
  static async updateRecord(
    pool: Pool,
    schemaName: string,
    tableName: string,
    recordId: string,
    payload: Record<string, any>
  ): Promise<any> {
    const ctx = await resolveSessionContext();

    await AccessGuard.checkPermission(tableName, 'update', {
      userId: ctx.userId,
      jwtRole: ctx.role,
    });

    return TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        // 1. Capture old values first
        const selectSql = format('SELECT * FROM %I.%I WHERE id = %L', schemaName, tableName, recordId);
        const oldResult = await client.query(selectSql);
        if (oldResult.rows.length === 0) {
          throw new Error('Record not found or access denied by RLS.');
        }
        const oldRecord = oldResult.rows[0];

        // 2. Build SET clauses with audit columns
        const dataToUpdate = { ...payload, updated_by: ctx.userId, updated_at: new Date().toISOString() };
        const setClauses = Object.keys(dataToUpdate).map((key) =>
          format('%I = %L', key, dataToUpdate[key])
        );

        // 3. Execute dynamic UPDATE
        const updateSql = format(
          'UPDATE %I.%I SET %s WHERE id = %L RETURNING *',
          schemaName,
          tableName,
          setClauses.join(', '),
          recordId
        );
        const result = await client.query(updateSql);
        const newRecord = result.rows[0];

        // 4. Write Audit Log in the SAME pg transaction (atomic)
        const auditSql = format(
          `INSERT INTO core.audit_logs (id, tenant_id, user_id, action, object_name, record_id, old_values, new_values) 
           VALUES (gen_random_uuid(), %L, %L, 'UPDATE', %L, %L, %L, %L)`,
          ctx.tenantId,
          ctx.userId,
          tableName,
          recordId,
          JSON.stringify(oldRecord),
          JSON.stringify(newRecord)
        );
        await client.query(auditSql);

        return newRecord;
      },
      { 
        userId: ctx.userId, 
        tenantId: ctx.tenantId, 
        role: ctx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: ctx.activeTeamId
      }
    );
  }

  /**
   * Deletes a record securely. Automatically resolves session context.
   * Captures the deleted state in the Audit Log within the same atomic transaction.
   */
  static async deleteRecord(
    pool: Pool,
    schemaName: string,
    tableName: string,
    recordId: string
  ): Promise<void> {
    const ctx = await resolveSessionContext();

    await AccessGuard.checkPermission(tableName, 'delete', {
      userId: ctx.userId,
      jwtRole: ctx.role,
    });

    return TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        // 1. Capture old values first
        const selectSql = format('SELECT * FROM %I.%I WHERE id = %L', schemaName, tableName, recordId);
        const oldResult = await client.query(selectSql);
        if (oldResult.rows.length === 0) {
          throw new Error('Record not found or access denied by RLS.');
        }
        const oldRecord = oldResult.rows[0];

        // 2. Execute dynamic DELETE
        const deleteSql = format('DELETE FROM %I.%I WHERE id = %L', schemaName, tableName, recordId);
        await client.query(deleteSql);

        // 3. Write Audit Log in the SAME pg transaction (atomic)
        const auditSql = format(
          `INSERT INTO core.audit_logs (id, tenant_id, user_id, action, object_name, record_id, old_values) 
           VALUES (gen_random_uuid(), %L, %L, 'DELETE', %L, %L, %L)`,
          ctx.tenantId,
          ctx.userId,
          tableName,
          recordId,
          JSON.stringify(oldRecord)
        );
        await client.query(auditSql);
      },
      { 
        userId: ctx.userId, 
        tenantId: ctx.tenantId, 
        role: ctx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: ctx.activeTeamId
      }
    );
  }
}
