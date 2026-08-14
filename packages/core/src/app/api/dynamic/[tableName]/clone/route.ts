/**
 * POST /api/dynamic/[tableName]/clone — Deep Clone
 *
 * Copies the record plus selected child records (one level deep) in a single
 * RLS-scoped transaction. Child tables are identified by a relation field
 * whose config.targetTable matches the parent table.
 *
 * Body: { id: <recordId>, include: [childTableName, ...] }
 * Returns: { record, cloned: { [childTable]: count } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { QueryLayer, generateTimeOrderedId } from '@/core/engine/QueryLayer';
import { resolveTable } from '@/lib/dynamicTable';
import format from 'pg-format';
import { requireSession } from '@/lib/auth/session';
import { SYSTEM_PROTECTED_COLUMNS } from '@sails/shared';

type RouteContext = { params: { tableName: string } };

/** Copy user-editable column values; system/auto-number/expression are skipped
 *  (auto-number regenerates via DEFAULT, expressions recompute server-side). */
function buildClonePayload(row: Record<string, any>, fields: any[]): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const f of fields || []) {
    const key = f.fieldName;
    if (!key || SYSTEM_PROTECTED_COLUMNS.includes(key)) continue;
    const lt = String(f.logicalType || '').toLowerCase();
    if (lt === 'auto_number' || lt === 'expression') continue;
    if (row[key] !== undefined && row[key] !== null) payload[key] = row[key];
  }
  return payload;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const session = await requireSession();
    const { id, include = [] } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing required body field: id.' }, { status: 400 });
    }

    const parent = await resolveTable(tableName);
    if (!parent) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    const result = await QueryLayer.executeSecureQuery(
      pool,
      tableName,
      'create',
      async (client) => {
        // 1. Read the parent row (RLS-scoped).
        const parentSql = format('SELECT * FROM %I.%I WHERE id = $1', parent.schemaName, tableName);
        const parentRow = (await client.query(parentSql, [id])).rows[0];
        if (!parentRow) throw new Error('Record not found or access denied.');

        const audit: string[] = [];
        const newParentId = generateTimeOrderedId();

        // 2. Insert the parent copy.
        const parentPayload = buildClonePayload(parentRow, parent.table.fields || []);
        const parentData = {
          id: newParentId,
          ...parentPayload,
          owner_id: session.userId,
          owner_team_id: session.activeTeamId || null,
          created_by: session.userId,
          updated_by: session.userId,
        };
        const pCols = Object.keys(parentData);
        const pVals = Object.values(parentData);
        const parentInsert = format(
          'INSERT INTO %I.%I (%I) VALUES (%L) RETURNING *',
          parent.schemaName,
          tableName,
          pCols,
          pVals
        );
        const newParent = (await client.query(parentInsert)).rows[0];
        audit.push(
          `INSERT INTO core.data_audit_logs (id, tenant_id, user_id, action, object_name, record_id, new_values) VALUES (${format('%L', generateTimeOrderedId())}, ${format('%L', session.tenantId)}, ${format('%L', session.userId)}, 'CREATE', ${format('%L', tableName)}, ${format('%L', newParentId)}, ${format('%L', JSON.stringify(newParent))})`
        );

        // 3. Copy selected child records (one level deep).
        const cloned: Record<string, number> = {};
        for (const childTableName of include) {
          const child = await resolveTable(String(childTableName));
          if (!child) continue;

          const fkField = (child.table.fields || []).find(
            (f: any) => String(f.config?.targetTable || '') === tableName
          );
          if (!fkField) continue; // not a relation to this table — skip

          const fkCol = fkField.fieldName;
          const childSql = format(
            'SELECT * FROM %I.%I WHERE %I = $1',
            child.schemaName,
            childTableName,
            fkCol
          );
          const childRows = (await client.query(childSql, [id])).rows;
          let count = 0;
          for (const childRow of childRows) {
            const payload = buildClonePayload(childRow, child.table.fields || []);
            const newChildId = generateTimeOrderedId();
            payload[fkCol] = newParentId; // rebind the FK to the new parent
            const data = {
              id: newChildId,
              ...payload,
              owner_id: session.userId,
              owner_team_id: session.activeTeamId || null,
              created_by: session.userId,
              updated_by: session.userId,
            };
            const cols = Object.keys(data);
            const vals = Object.values(data);
            const insert = format(
              'INSERT INTO %I.%I (%I) VALUES (%L) RETURNING *',
              child.schemaName,
              childTableName,
              cols,
              vals
            );
            const newChild = (await client.query(insert)).rows[0];
            audit.push(
              `INSERT INTO core.data_audit_logs (id, tenant_id, user_id, action, object_name, record_id, new_values) VALUES (${format('%L', generateTimeOrderedId())}, ${format('%L', session.tenantId)}, ${format('%L', session.userId)}, 'CREATE', ${format('%L', childTableName)}, ${format('%L', newChildId)}, ${format('%L', JSON.stringify(newChild))})`
            );
            count++;
          }
          cloned[childTableName] = count;
        }

        return { newParent, cloned, audit };
      }
    );

    // Audit logs fire-and-forget after commit (same pattern as QueryLayer).
    for (const sql of result.audit) {
      pool.query(sql).catch((err) => console.error('[Clone] Failed to write audit log:', err));
    }

    return NextResponse.json({ record: result.newParent, cloned: result.cloned }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to clone record.' }, { status });
  }
}
