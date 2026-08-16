/**
 * QueryLayer — the single secure data-access layer for dynamic tables.
 *
 * Every read/write to tenant data funnels through here:
 *   insertRecord / updateRecord / upsertRecord / deleteRecord / listRecords
 * Each operation runs inside TransactionContext (RLS + session vars),
 * passes AccessGuard (RBAC), writes data_audit_logs, and — since the
 * Expression-field feature — evaluates computed fields on write.
 */
import { Pool, PoolClient } from 'pg';
import format from 'pg-format';
import crypto from 'crypto';
import { SYSTEM_PROTECTED_COLUMNS } from '@sails/shared';
import { AccessGuard, CrudAction } from './AccessGuard';
import { TransactionContext } from './TransactionContext';
import { computeRecordExpressions } from './ComputedFields';
import { triggerBoundWorkflows } from './WorkflowTriggers';
import { getSession, SessionContext } from '@/lib/auth/session';

/** One rule inside a Query Studio filter group, as received from the API route. */
export interface FilterGroupRule {
  field: string;
  operator: string;
  value: string;
  logic: 'and' | 'or';
  /** LHS drill path as physical column names; chain[0] lives on the root table. */
  chain?: string[];
  refField?: string;
  /** RHS field-source drill path as physical column names. */
  refChain?: string[];
  refRecordId?: string;
  contextN?: number;
  /** 'workflow' value source — resolved against the workflow context before SQL. */
  workflowRef?: string;
  /** Resolved by the route: physical table name for the record-source subquery. */
  targetTable?: string;
  /** Resolved by the route: table where each LHS chain hop lives (chainTables[0] = root). */
  chainTables?: string[];
  /** Resolved by the route: table where each RHS refChain hop lives. */
  refChainTables?: string[];
}

/**
 * Generates a time-ordered string ID (similar to CUID/UUIDv7)
 * to prevent B-Tree fragmentation in PostgreSQL.
 * 24 chars — fits VARCHAR(30) id columns in dynamic tables.
 */
export function generateTimeOrderedId(): string {
  return Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
}

/**
 * Strips platform-owned columns from a client payload so system/audit
 * values can never be set or overwritten by request bodies.
 */
function stripProtectedColumns(payload: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!SYSTEM_PROTECTED_COLUMNS.includes(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

async function resolveSessionContext(): Promise<SessionContext> {
  const ctx = await getSession();

  if (!ctx?.userId) {
    throw new Error('Unauthorized: No active session. Please sign in.');
  }
  if (!ctx?.tenantId) {
    throw new Error('Forbidden: User is not associated with any tenant.');
  }

  return ctx;
}

export type { SessionContext };

/** Options consumed by `buildWhereClause` — the filter/search inputs for a list query. */
export interface WhereClauseOptions {
  filters?: Record<string, string>;
  filterGroups?: { groupLogic: 'and' | 'or'; rules: FilterGroupRule[] }[];
  search?: string;
  validFields: Set<string>;
  textFields: string[];
  jsonbFields?: Set<string>;
}

/**
 * Builds the SQL `WHERE …` fragment for legacy flat filters, Query Studio grouped
 * filters, and free-text search. Field names are validated against `validFields`;
 * every value is bound via pg-format. Returns an empty string when no filter applies.
 */
export function buildWhereClause(schemaName: string, options: WhereClauseOptions): string {
  const jsonbFields = options.jsonbFields || new Set<string>();
  const eqExpr = (f: string) => (jsonbFields.has(f) ? '%I::text = %L' : '%I = %L');
  const neqExpr = (f: string) => (jsonbFields.has(f) ? '%I::text != %L' : '%I != %L');
  const cmpExpr = (f: string) => (jsonbFields.has(f) ? '%I::text %s %L' : '%I %s %L');

  /** Build a WHERE fragment for one rule (chain + operand parts combined); null when unusable. */
  const buildClause = (
    fieldName: string,
    operator: string,
    rawValue: string,
    extra?: { refField?: string; refRecordId?: string; targetTable?: string; chain?: string[]; chainTables?: string[]; refChain?: string[]; refChainTables?: string[] }
  ): string | null => {
    // LHS drill chain: chain[0] must be a valid column of the root table.
    if (extra?.chain && extra.chain.length > 0 && !options.validFields.has(extra.chain[0])) return null;
    if (!extra?.chain && !options.validFields.has(fieldName)) return null;

    const parts: string[] = [];

    // ── LHS drill chain: nested EXISTS through related models ──
    // chain = [c0 (root), c1, c2 …]; chainTables[i] = table where chain[i] lives.
    if (extra?.chain && extra.chain.length > 1 && extra.chainTables && extra.chainTables.length === extra.chain.length) {
      const chain = extra.chain;
      const tables = extra.chainTables;
      let inner = '';
      for (let i = chain.length - 1; i >= 1; i--) {
        const alias = `c${i}`;
        // Link this table's id to the previous hop's relation column.
        const outerRef = i - 1 === 0 ? format('%I', chain[0]) : format('%I.%I', `c${i - 1}`, chain[i - 1]);
        const conds = [format('%I.%I = %s', alias, 'id', outerRef)];
        if (i === chain.length - 1) {
          // Terminal hop: also compare the drilled field against the operand.
          switch (operator) {
            case 'contains': conds.push(format('%I.%I::text ILIKE %L', alias, chain[i], `%${rawValue}%`)); break;
            case 'is_empty': conds.push(format('(%I.%I IS NULL OR %I.%I::text = %L)', alias, chain[i], alias, chain[i], '')); break;
            case 'is_not_empty': conds.push(format('(%I.%I IS NOT NULL AND %I.%I::text != %L)', alias, chain[i], alias, chain[i], '')); break;
            default: {
              const sym = operator === 'eq' ? '=' : operator === 'neq' ? '!=' : operator === 'gt' ? '>' : operator === 'gte' ? '>=' : operator === 'lt' ? '<' : operator === 'lte' ? '<=' : null;
              if (!sym) return null;
              conds.push(format('%I.%I %s %L', alias, chain[i], sym, rawValue));
            }
          }
        }
        inner = `EXISTS (SELECT 1 FROM ${format('%I.%I', schemaName, tables[i])} ${alias} WHERE ${conds.join(' AND ')}${inner ? ` AND ${inner}` : ''})`;
      }
      // The chain clause is self-contained (terminal comparison included) — do not
      // fall through to the plain literal branch below.
      return inner;
    }

    // ── RHS field-source drill chain: lhs op ANY (JOIN walk to the terminal field) ──
    if (extra?.refChain && extra.refChain.length > 1 && extra.refChainTables && extra.refChainTables.length === extra.refChain.length) {
      const rc = extra.refChain;
      const tables = extra.refChainTables;
      const lhs = extra.chain && extra.chain.length > 0 ? extra.chain[0] : fieldName;
      const lastIdx = rc.length - 1;
      // SELECT from the deepest table; join shallower tables back through their
      // relation columns: prev."rc[i]" = cur."id".
      let joins = '';
      for (let i = lastIdx - 1; i >= 1; i--) {
        joins += ` JOIN ${format('%I.%I', schemaName, tables[i])} c${i} ON c${i}.${rc[i]} = c${i + 1}.id`;
      }
      const sub = `SELECT c${lastIdx}.${rc[lastIdx]}::text FROM ${format('%I.%I', schemaName, tables[lastIdx])} c${lastIdx}${joins} WHERE c1.id = ${format('%I', rc[0])}`;
      const sym = operator === 'eq' ? '=' : operator === 'neq' ? '!=' : operator === 'gt' ? '>' : operator === 'gte' ? '>=' : operator === 'lt' ? '<' : operator === 'lte' ? '<=' : null;
      if (sym) parts.push(format('%I::text %s ANY (%s)', lhs, sym, sub));
      return parts.length > 0 ? parts.join(' AND ') : null;
    }

    // Record source: compare against a field of a specific related record.
    if (extra?.refField && extra.refRecordId && extra.targetTable) {
      const sub = format('SELECT %I::text FROM %I.%I WHERE id = %L', extra.refField, schemaName, extra.targetTable, extra.refRecordId);
      const sym = operator === 'eq' ? '=' : operator === 'neq' ? '!=' : operator === 'gt' ? '>' : operator === 'gte' ? '>=' : operator === 'lt' ? '<' : operator === 'lte' ? '<=' : null;
      if (sym) parts.push(format('%I::text %s (%s)', fieldName, sym, sub));
      return parts.length > 0 ? parts.join(' AND ') : null;
    }

    // Field-to-field comparison on the same row: lhs <op> rhs (both identifiers).
    if (extra?.refField && !extra.refRecordId) {
      const rhs = extra.refField;
      switch (operator) {
        case 'eq': parts.push(format('%I = %I', fieldName, rhs)); break;
        case 'neq': parts.push(format('%I != %I', fieldName, rhs)); break;
        case 'gt': parts.push(format('%I > %I', fieldName, rhs)); break;
        case 'gte': parts.push(format('%I >= %I', fieldName, rhs)); break;
        case 'lt': parts.push(format('%I < %I', fieldName, rhs)); break;
        case 'lte': parts.push(format('%I <= %I', fieldName, rhs)); break;
        case 'contains': parts.push(format('%I::text ILIKE %I::text', fieldName, rhs)); break;
        default: return null;
      }
      return parts.length > 0 ? parts.join(' AND ') : null;
    }

    // Plain literal comparison.
    if (
      rawValue === undefined ||
      rawValue === null ||
      (typeof rawValue === 'string' && rawValue.trim() === '' && operator !== 'is_empty' && operator !== 'is_not_empty')
    ) {
      return null;
    }

    switch (operator) {
      case 'eq': parts.push(format(eqExpr(fieldName), fieldName, rawValue)); break;
      case 'neq': parts.push(format(neqExpr(fieldName), fieldName, rawValue)); break;
      case 'contains': parts.push(format('%I::text ILIKE %L', fieldName, `%${rawValue}%`)); break;
      case 'gt': parts.push(format(cmpExpr(fieldName), fieldName, '>', rawValue)); break;
      case 'gte': parts.push(format(cmpExpr(fieldName), fieldName, '>=', rawValue)); break;
      case 'lt': parts.push(format(cmpExpr(fieldName), fieldName, '<', rawValue)); break;
      case 'lte': parts.push(format(cmpExpr(fieldName), fieldName, '<=', rawValue)); break;
      case 'is_empty': parts.push(format('(%I IS NULL OR %I::text = %L)', fieldName, fieldName, '')); break;
      case 'is_not_empty': parts.push(format('(%I IS NOT NULL AND %I::text != %L)', fieldName, fieldName, '')); break;
      default: return null;
    }

    return parts.length > 0 ? parts.join(' AND ') : null;
  };

  const whereClauses: { sql: string; joinLogic: 'and' | 'or' }[] = [];

  // Legacy flat filters — treated as a single implicit AND group.
  if (options.filters) {
    for (const [rawKey, rawValue] of Object.entries(options.filters)) {
      const colonIdx = rawKey.lastIndexOf(':');
      const fieldName = colonIdx > -1 ? rawKey.substring(0, colonIdx) : rawKey;
      const operator = colonIdx > -1 ? rawKey.substring(colonIdx + 1) : 'eq';
      const clause = buildClause(fieldName, operator, rawValue);
      if (clause) whereClauses.push({ sql: clause, joinLogic: 'and' });
    }
  }

  // Query Studio grouped filters — (rules AND/OR) joined by groupLogic.
  if (options.filterGroups && options.filterGroups.length > 0) {
    for (const grp of options.filterGroups) {
      if (!grp || !Array.isArray(grp.rules) || grp.rules.length === 0) continue;
      const ruleClauses: string[] = [];
      for (const rule of grp.rules) {
        if (!rule) continue;
        const clause = buildClause(rule.field, rule.operator || 'eq', rule.value, {
          refField: rule.refField,
          refRecordId: rule.refRecordId,
          targetTable: rule.targetTable,
          chain: rule.chain,
          chainTables: rule.chainTables,
          refChain: rule.refChain,
          refChainTables: rule.refChainTables,
        });
        if (clause) ruleClauses.push(clause);
      }
      if (ruleClauses.length === 0) continue;
      let groupSQL = ruleClauses[0];
      for (let i = 1; i < ruleClauses.length; i++) {
        const logic = grp.rules[i]?.logic === 'or' ? 'OR' : 'AND';
        groupSQL = `(${groupSQL} ${logic} ${ruleClauses[i]})`;
      }
      whereClauses.push({ sql: groupSQL, joinLogic: grp.groupLogic === 'or' ? 'or' : 'and' });
    }
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim();
    const searchClauses = options.textFields
      .filter(f => options.validFields.has(f))
      .map(f => format('%I::text ILIKE %L', f, `%${q}%`));

    if (searchClauses.length > 0) {
      whereClauses.push({ sql: `(${searchClauses.join(' OR ')})`, joinLogic: 'and' });
    }
  }

  let whereSQL = '';
  if (whereClauses.length > 0) {
    let sql = whereClauses[0].sql;
    for (let i = 1; i < whereClauses.length; i++) {
      sql = `${sql} ${whereClauses[i].joinLogic.toUpperCase()} ${whereClauses[i].sql}`;
    }
    whereSQL = `WHERE ${sql}`;
  }

  return whereSQL;
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
    ctx?: SessionContext,
    fields?: any[]
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
        //    A payload-provided id (workflow mapping) wins over generation.
        const generatedId = payload.id || generateTimeOrderedId();
        const dataToInsert = { 
          id: generatedId,
          ...stripProtectedColumns(payload), 
          owner_id: resolvedCtx.userId, 
          owner_team_id: resolvedCtx.activeTeamId,
          created_by: resolvedCtx.userId, 
          updated_by: resolvedCtx.userId 
        };

        // 1b. Compute Expression fields — the computed value always wins.
        if (fields && fields.length > 0) {
          const computed = await computeRecordExpressions(client, schemaName, tableName, fields, dataToInsert);
          for (const [key, value] of Object.entries(computed.values)) {
            dataToInsert[key] = value;
          }
        }

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

    // 5. Record Trigger hook (fire-and-forget — never fails the write)
    if (resolvedCtx.suppressRecordTriggers) return;
    void triggerBoundWorkflows({
      tenantId: resolvedCtx.tenantId,
      tableName,
      operation: 'create',
      recordId: result.newRecord.id,
      values: result.newRecord,
      actorId: resolvedCtx.userId,
    }).catch(err => console.error('[WorkflowTriggers] create trigger failed:', err));

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
    ctx?: SessionContext,
    fields?: any[]
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
        const dataToUpdate = { ...stripProtectedColumns(payload), updated_by: resolvedCtx.userId, updated_at: new Date().toISOString() };

        // 2b. Compute Expression fields against old + new values — the
        //     computed value always wins over the client payload.
        if (fields && fields.length > 0) {
          const merged = { ...oldRecord, ...dataToUpdate };
          const computed = await computeRecordExpressions(client, schemaName, tableName, fields, merged);
          for (const [key, value] of Object.entries(computed.values)) {
            dataToUpdate[key] = value;
          }
        }

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

        return { newRecord, oldRecord, auditSql };
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

    // 6. Record Trigger hook (fire-and-forget — never fails the write)
    if (resolvedCtx.suppressRecordTriggers) return;
    void triggerBoundWorkflows({
      tenantId: resolvedCtx.tenantId,
      tableName,
      operation: 'update',
      recordId,
      values: result.newRecord,
      oldValues: result.oldRecord,
      actorId: resolvedCtx.userId,
    }).catch(err => console.error('[WorkflowTriggers] update trigger failed:', err));

    return result.newRecord;
  }

  /**
   * Upserts a record securely: inserts it, or updates the row with the given
   * id when one already exists (INSERT ... ON CONFLICT (id) DO UPDATE).
   * Requires BOTH create and update permissions (RLS also enforces both on
   * the ON CONFLICT update path). Logs 'CREATE' or 'UPDATE' to the Audit Log.
   * Pass idValue = null to force a pure insert (generates a new id).
   */
  static async upsertRecord(
    pool: Pool,
    schemaName: string,
    tableName: string,
    idValue: string | null,
    payload: Record<string, any>,
    ctx?: SessionContext,
    fields?: any[]
  ): Promise<any> {
    const resolvedCtx = ctx ?? await resolveSessionContext();

    await AccessGuard.checkPermission(tableName, 'create', {
      userId: resolvedCtx.userId,
      jwtRole: resolvedCtx.role,
    });
    await AccessGuard.checkPermission(tableName, 'update', {
      userId: resolvedCtx.userId,
      jwtRole: resolvedCtx.role,
    });

    const result = await TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        // 1. Capture the existing row first (drives the audit action)
        let oldRecord: any = null;
        if (idValue) {
          const oldResult = await client.query(format('SELECT * FROM %I.%I WHERE id = %L', schemaName, tableName, idValue));
          oldRecord = oldResult.rows[0] || null;
        }

        // 2. Build the payload with audit columns. On the update path we only
        //    overwrite mutable columns — created_by/owner_id survive via the
        //    INSERT branch being skipped for existing rows.
        const generatedId = idValue || generateTimeOrderedId();
        const cleanPayload = stripProtectedColumns(payload);
        const dataToInsert = {
          id: generatedId,
          ...cleanPayload,
          owner_id: resolvedCtx.userId,
          owner_team_id: resolvedCtx.activeTeamId,
          created_by: resolvedCtx.userId,
          updated_by: resolvedCtx.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const columns = Object.keys(dataToInsert);
        const values = Object.values(dataToInsert);
        const updateCols = Object.keys(cleanPayload).concat(['updated_by', 'updated_at']);

        // 2b. Compute Expression fields — the computed value always wins.
        //     On the update path, evaluate against old + new merged values.
        if (fields && fields.length > 0) {
          const merged = oldRecord ? { ...oldRecord, ...dataToInsert } : dataToInsert;
          const computed = await computeRecordExpressions(client, schemaName, tableName, fields, merged);
          for (const [key, value] of Object.entries(computed.values)) {
            dataToInsert[key] = value;
            if (!updateCols.includes(key)) updateCols.push(key);
          }
        }

        // 3. Execute dynamic UPSERT
        const upsertSql = format(
          'INSERT INTO %I.%I (%I) VALUES (%L) ON CONFLICT (id) DO UPDATE SET %s RETURNING *',
          schemaName,
          tableName,
          columns,
          values,
          updateCols.map((key) => format('%I = EXCLUDED.%I', key, key)).join(', ')
        );
        const upsertResult = await client.query(upsertSql);
        const newRecord = upsertResult.rows[0];

        // 4. Prepare Audit Log (executed outside of transaction)
        const action = oldRecord ? 'UPDATE' : 'CREATE';
        const auditSql = format(
          `INSERT INTO core.data_audit_logs (id, tenant_id, user_id, action, object_name, record_id, old_values, new_values) 
            VALUES (%L, %L, %L, %L, %L, %L, %L, %L)`,
          generateTimeOrderedId(),
          resolvedCtx.tenantId,
          resolvedCtx.userId,
          action,
          tableName,
          newRecord.id,
          oldRecord ? JSON.stringify(oldRecord) : null,
          JSON.stringify(newRecord)
        );

        return { newRecord, oldRecord, action, auditSql };
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

    // 6. Record Trigger hook (fire-and-forget — never fails the write)
    if (resolvedCtx.suppressRecordTriggers) return;
    void triggerBoundWorkflows({
      tenantId: resolvedCtx.tenantId,
      tableName,
      operation: result.action === 'CREATE' ? 'create' : 'update',
      recordId: result.newRecord.id,
      values: result.newRecord,
      oldValues: result.oldRecord || undefined,
      actorId: resolvedCtx.userId,
    }).catch(err => console.error('[WorkflowTriggers] upsert trigger failed:', err));

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
        return { oldRecord, auditSql };
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

    // 5. Record Trigger hook (fire-and-forget — never fails the write)
    if (resolvedCtx.suppressRecordTriggers) return;
    void triggerBoundWorkflows({
      tenantId: resolvedCtx.tenantId,
      tableName,
      operation: 'delete',
      recordId,
      values: result.oldRecord,
      actorId: resolvedCtx.userId,
    }).catch(err => console.error('[WorkflowTriggers] delete trigger failed:', err));
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
      filterGroups?: { groupLogic: 'and' | 'or'; rules: FilterGroupRule[] }[];
      search?: string;
      sort?: { fieldId: string; dir: 'asc' | 'desc' }[];
      page?: number;
      limit?: number;
      validFields: Set<string>;
      textFields: string[];
      jsonbFields?: Set<string>;
      /** Live aggregate summaries: [{ fieldName, aggregate }] — computed over
       *  ALL rows matching the same filters (not just the current page) inside
       *  the same RLS transaction as the list. */
      aggregates?: { fieldName: string; aggregate: 'sum' | 'avg' | 'min' | 'max' | 'count' }[];
      /** Pre-resolved session context (tests/engines); otherwise resolved from the request session. */
      ctx?: SessionContext;
    }
  ): Promise<{ rows: any[]; total: number; page: number; limit: number; totalPages: number; aggregates?: { fieldName: string; aggregate: string; value: any }[] }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const offset = (page - 1) * limit;

    const jsonbFields = options.jsonbFields || new Set<string>();
    const whereSQL = buildWhereClause(schemaName, options);

    const orderByClauses: string[] = [];
    if (options.sort && options.sort.length > 0) {
      for (const rule of options.sort) {
        if (!options.validFields.has(rule.fieldId)) continue;
        const dir = rule.dir === 'desc' ? 'DESC' : 'ASC';
        const colExpr = jsonbFields.has(rule.fieldId) ? '%I::text %s' : '%I %s';
        orderByClauses.push(format(colExpr, rule.fieldId, dir));
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

      const dataResult = await client.query(dataSQL);
      const countResult = await client.query(countSQL);

      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // Live aggregates over the FULL filtered set (RLS-enforced, same WHERE).
      let aggregates: { fieldName: string; aggregate: string; value: any }[] | undefined;
      if (options.aggregates && options.aggregates.length > 0) {
        const aggSQL = options.aggregates.map((a, i) => {
          const op = a.aggregate === 'count' ? 'COUNT(%I)' : `${a.aggregate.toUpperCase()}(COALESCE(%I::numeric, 0))::float8`;
          return `${format(op, a.fieldName, a.fieldName)} AS a${i}`;
        }).join(', ');
        const sql = format(
          'SELECT %s FROM %I.%I %s',
          aggSQL, schemaName, tableName, whereSQL
        );
        const aggResult = await client.query(sql);
        const row = aggResult.rows[0] || {};
        aggregates = options.aggregates.map((a, i) => ({
          fieldName: a.fieldName,
          aggregate: a.aggregate,
          value: row[`a${i}`] ?? null,
        }));
      }

      return {
        rows: dataResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        ...(aggregates ? { aggregates } : {}),
      };
    }, options.ctx);
  }
}