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

  /**
   * List records with server-side filtering, sorting, searching, and pagination.
   *
   * All field names in filters/sort are validated against `validFields` before use.
   * Both SELECT and COUNT run inside a single RLS-secured transaction context.
   *
   * @param pool        PG connection pool
   * @param schemaName  Tenant schema (e.g. `tenant_acme`)
   * @param tableName   Physical table name (e.g. `leads`)
   * @param options     Query parameters
   */
  static async listRecords(
    pool: Pool,
    schemaName: string,
    tableName: string,
    options: {
      filters?: Record<string, string>;
      search?: string;
      sort?: { fieldId: string; dir: 'asc' | 'desc' }[];
      page?: number;
      limit?: number;
      validFields: Set<string>;
      textFields: string[];
    }
  ): Promise<{ rows: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];

    if (options.filters) {
      for (const [rawKey, rawValue] of Object.entries(options.filters)) {
        if (rawValue === undefined || rawValue === null || (typeof rawValue === 'string' && rawValue.trim() === '' && !rawKey.endsWith(':is_empty') && !rawKey.endsWith(':is_not_empty'))) {
          continue;
        }

        const colonIdx = rawKey.lastIndexOf(':');
        const fieldName = colonIdx > -1 ? rawKey.substring(0, colonIdx) : rawKey;
        const operator = colonIdx > -1 ? rawKey.substring(colonIdx + 1) : 'eq';

        if (!options.validFields.has(fieldName)) continue;

        switch (operator) {
          case 'eq':
            whereClauses.push(format('%I = %L', fieldName, rawValue));
            break;
          case 'neq':
            whereClauses.push(format('%I != %L', fieldName, rawValue));
            break;
          case 'contains':
            whereClauses.push(format('%I::text ILIKE %L', fieldName, `%${rawValue}%`));
            break;
          case 'gt':
            whereClauses.push(format('%I > %L', fieldName, rawValue));
            break;
          case 'gte':
            whereClauses.push(format('%I >= %L', fieldName, rawValue));
            break;
          case 'lt':
            whereClauses.push(format('%I < %L', fieldName, rawValue));
            break;
          case 'lte':
            whereClauses.push(format('%I <= %L', fieldName, rawValue));
            break;
          case 'is_empty':
            whereClauses.push(format('(%I IS NULL OR %I::text = %L)', fieldName, fieldName, ''));
            break;
          case 'is_not_empty':
            whereClauses.push(format('(%I IS NOT NULL AND %I::text != %L)', fieldName, fieldName, ''));
            break;
        }
      }
    }

    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      const searchClauses = options.textFields
        .filter(f => options.validFields.has(f))
        .map(f => format('%I::text ILIKE %L', f, `%${q}%`));

      if (searchClauses.length > 0) {
        whereClauses.push(`(${searchClauses.join(' OR ')})`);
      }
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const orderByClauses: string[] = [];
    if (options.sort && options.sort.length > 0) {
      for (const rule of options.sort) {
        if (!options.validFields.has(rule.fieldId)) continue;
        const dir = rule.dir === 'desc' ? 'DESC' : 'ASC';
        orderByClauses.push(format('%I %s', rule.fieldId, dir));
      }
    }
    if (orderByClauses.length === 0) {
      orderByClauses.push('created_at DESC');
    }
    const orderBySQL = `ORDER BY ${orderByClauses.join(', ')}`;

    return QueryLayer.executeSecureQuery(pool, tableName, 'read', async (client) => {
      const dataSQL = format(
        'SELECT * FROM %I.%I %s %s LIMIT %s OFFSET %s',
        schemaName, tableName, whereSQL, orderBySQL, limit, offset
      );
      const countSQL = format(
        'SELECT COUNT(*)::int AS total FROM %I.%I %s',
        schemaName, tableName, whereSQL
      );

      const [dataResult, countResult] = await Promise.all([
        client.query(dataSQL),
        client.query(countSQL),
      ]);

      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      return {
        rows: dataResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }
}
