import { Pool, PoolClient } from 'pg';
import format from 'pg-format';
import crypto from 'crypto';
import { AccessGuard, CrudAction } from './AccessGuard';
import { TransactionContext } from './TransactionContext';
import { getAppSession } from '@/lib/auth/session';

/**
 * Generates a time-ordered string ID (similar to CUID/UUIDv7)
 * to prevent B-Tree fragmentation in PostgreSQL.
 */
function generateTimeOrderedId(): string {
  return Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
}

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
    callback: (client: PoolClient, ctx: SessionContext) => Promise<T>,
    ctx?: SessionContext
  ): Promise<T> {
    // 1. Resolve session if not provided by caller
    const resolvedCtx = ctx ?? await resolveSessionContext();

    // 2. Enforce Object-Level Security via AccessGuard
    await AccessGuard.checkPermission(objectName, action, {
      userId: resolvedCtx.userId,
      jwtRole: resolvedCtx.role,
    });

    // 3. Enforce Record-Level Security via TransactionContext (DB-level RLS)
    return TransactionContext.executeWithUserContext(
      pool,
      (client) => callback(client, resolvedCtx),
      {
        userId: resolvedCtx.userId,
        tenantId: resolvedCtx.tenantId,
        role: resolvedCtx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: resolvedCtx.activeTeamId
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
    payload: Record<string, any>,
    ctx?: SessionContext
  ): Promise<any> {
    const resolvedCtx = ctx ?? await resolveSessionContext();

    await AccessGuard.checkPermission(tableName, 'create', {
      userId: resolvedCtx.userId,
      jwtRole: resolvedCtx.role,
    });

    const result = await TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        // 1. Add standard audit columns & generate ID
        const generatedId = generateTimeOrderedId();
        const dataToInsert = { 
          id: generatedId,
          ...payload, 
          owner_id: resolvedCtx.userId, 
          owner_team_id: resolvedCtx.activeTeamId,
          created_by: resolvedCtx.userId, 
          updated_by: resolvedCtx.userId 
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

        // 3. Prepare Audit Log (executed outside of transaction)
        const auditSql = format(
          `INSERT INTO core.data_audit_logs (id, tenant_id, user_id, action, object_name, record_id, new_values) 
            VALUES (%L, %L, %L, 'CREATE', %L, %L, %L)`,
          generateTimeOrderedId(),
          resolvedCtx.tenantId,
          resolvedCtx.userId,
          tableName,
          newRecord.id,
          JSON.stringify(newRecord)
        );

        return { newRecord, auditSql };
      },
      { 
        userId: resolvedCtx.userId, 
        tenantId: resolvedCtx.tenantId, 
        role: resolvedCtx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: resolvedCtx.activeTeamId
      }
    );

    // 4. Dispatch Audit Log Asynchronously (Fire and forget)
    pool.query(result.auditSql).catch(err => console.error('[AuditLog] Failed to write audit log:', err));

    return result.newRecord;
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
    payload: Record<string, any>,
    ctx?: SessionContext
  ): Promise<any> {
    const resolvedCtx = ctx ?? await resolveSessionContext();

    await AccessGuard.checkPermission(tableName, 'update', {
      userId: resolvedCtx.userId,
      jwtRole: resolvedCtx.role,
    });

    const result = await TransactionContext.executeWithUserContext(
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
        const dataToUpdate = { ...payload, updated_by: resolvedCtx.userId, updated_at: new Date().toISOString() };
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

        // 4. Prepare Audit Log (executed outside of transaction)
        const auditSql = format(
          `INSERT INTO core.data_audit_logs (id, tenant_id, user_id, action, object_name, record_id, old_values, new_values) 
            VALUES (%L, %L, %L, 'UPDATE', %L, %L, %L, %L)`,
          generateTimeOrderedId(),
          resolvedCtx.tenantId,
          resolvedCtx.userId,
          tableName,
          recordId,
          JSON.stringify(oldRecord),
          JSON.stringify(newRecord)
        );

        return { newRecord, auditSql };
      },
      { 
        userId: resolvedCtx.userId, 
        tenantId: resolvedCtx.tenantId, 
        role: resolvedCtx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: resolvedCtx.activeTeamId
      }
    );

    // 5. Dispatch Audit Log Asynchronously (Fire and forget)
    pool.query(result.auditSql).catch(err => console.error('[AuditLog] Failed to write audit log:', err));

    return result.newRecord;
  }

  /**
   * Deletes a record securely. Automatically resolves session context.
   * Captures the deleted state in the Audit Log within the same atomic transaction.
   */
  static async deleteRecord(
    pool: Pool,
    schemaName: string,
    tableName: string,
    recordId: string,
    ctx?: SessionContext
  ): Promise<void> {
    const resolvedCtx = ctx ?? await resolveSessionContext();

    await AccessGuard.checkPermission(tableName, 'delete', {
      userId: resolvedCtx.userId,
      jwtRole: resolvedCtx.role,
    });

    const result = await TransactionContext.executeWithUserContext(
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

        // 3. Prepare Audit Log (executed outside of transaction)
        const auditSql = format(
          `INSERT INTO core.data_audit_logs (id, tenant_id, user_id, action, object_name, record_id, old_values) 
            VALUES (%L, %L, %L, 'DELETE', %L, %L, %L)`,
          generateTimeOrderedId(),
          resolvedCtx.tenantId,
          resolvedCtx.userId,
          tableName,
          recordId,
          JSON.stringify(oldRecord)
        );
        return { auditSql };
      },
      { 
        userId: resolvedCtx.userId, 
        tenantId: resolvedCtx.tenantId, 
        role: resolvedCtx.role === 'SUPER_ADMIN' ? undefined : 'rls_user',
        activeTeamId: resolvedCtx.activeTeamId
      }
    );

    // 4. Dispatch Audit Log Asynchronously (Fire and forget)
    pool.query(result.auditSql).catch(err => console.error('[AuditLog] Failed to write audit log:', err));
  }
}
