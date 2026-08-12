/**
 * Field options endpoint: resolves select/lookup/relation picker options,
 * including drill-chains through related models.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { QueryLayer, FilterGroupRule, buildWhereClause } from '@/core/engine/QueryLayer';
import { preprocessFilterGroups } from '@/core/engine/filterPreprocess';
import { resolveTable } from '@/lib/dynamicTable';
import { requireSession } from '@/lib/auth/session';
import { serializeFilterGroups, FilterGroup } from '@sails/shared';
import format from 'pg-format';

type RouteContext = { params: { tableName: string } };

/**
 * Builds an id → { tableName, fieldName } resolver across the source model and every
 * model reachable through relation/lookup fields (drill-chain hops). Field ids are
 * stable across renames, so the stored Query Studio filter keeps working even when a
 * source field is renamed.
 */
async function buildIdResolver(session: { tenantId: string }, sourceTable: string) {
  const map = new Map<string, { tableName: string; fieldName: string }>();
  const visited = new Set<string>();
  const queue: string[] = [sourceTable];

  while (queue.length > 0) {
    const tName = queue.shift() as string;
    if (visited.has(tName)) continue;
    visited.add(tName);

    const table = await db.tableDefinition.findFirst({
      where: { tenantId: session.tenantId, tableName: tName },
      include: { fields: true },
    });
    const fields = (table?.fields || []) as any[];
    for (const f of fields) {
      map.set(f.id, { tableName: tName, fieldName: f.fieldName });
      const lt = f.logicalType;
      const target = (lt === 'relation' || lt === 'lookup') ? (f.config as any)?.targetTable : null;
      if (target) queue.push(target);
    }
  }

  return map;
}

/**
 * GET /api/dynamic/[tableName]/options?column=<fieldName>&filterGroups=<json>
 *
 * Returns the distinct non-empty values of `column` from records of the source
 * model that match the Query Studio filter. `filterGroups` is the raw builder
 * output (field **ids**, the `FilterGroup[]` stored in a Selection field's
 * config); ids are resolved to physical column names server-side, so the
 * endpoint works for any signed-in user (no admin metadata access needed).
 *
 * The query runs inside executeSecureQuery, so RLS (record-level security) and
 * AccessGuard (object-level permission) apply exactly as they do for lists.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const { searchParams } = req.nextUrl;

    const column = searchParams.get('column') || '';
    const filterGroupsRaw = searchParams.get('filterGroups');
    const optionSearch = searchParams.get('search')?.trim() || '';
    const limitRaw = parseInt(searchParams.get('limit') || '500', 10);
    const limit = Math.min(2000, Math.max(1, isNaN(limitRaw) ? 500 : limitRaw));

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    const tableFields = (resolved.table?.fields || []) as any[];
    const validFields = new Set<string>(tableFields.map((f: any) => f.fieldName));

    if (!column || !validFields.has(column)) {
      return NextResponse.json({ error: 'A valid source column is required.' }, { status: 400 });
    }

    let serializedGroups: { groupLogic: 'and' | 'or'; rules: FilterGroupRule[] }[] | undefined;
    if (filterGroupsRaw) {
      try {
        const parsed = JSON.parse(filterGroupsRaw) as FilterGroup[];
        if (Array.isArray(parsed)) {
          const session = await requireSession();
          const resolver = await buildIdResolver(session, tableName);
          const groups = serializeFilterGroups(parsed, (id) => resolver.get(id)?.fieldName || null);
          if (groups.length > 0) {
            await preprocessFilterGroups({ session, tableName, tableFields, filterGroups: groups });
            serializedGroups = groups;
          }
        }
      } catch {
        serializedGroups = undefined;
      }
    }

    const jsonbFields = new Set<string>(
      tableFields
        .filter((f: any) => (f.physicalType || '').toLowerCase() === 'jsonb')
        .map((f: any) => f.fieldName)
    );

    const whereSQL = buildWhereClause(resolved.schemaName, {
      filterGroups: serializedGroups,
      validFields,
      textFields: tableFields.map((f: any) => f.fieldName),
      jsonbFields,
    });

    const extraSql = optionSearch
      ? format(' AND %I::text ILIKE %L', column, `%${optionSearch}%`)
      : '';

    const rows = await QueryLayer.executeSecureQuery(pool, tableName, 'read', async (client) => {
      const sql = format(
        'SELECT DISTINCT %I::text AS value FROM %I.%I %s%s ORDER BY value ASC LIMIT %s',
        column,
        resolved.schemaName,
        tableName,
        whereSQL,
        extraSql,
        limit
      );
      const result = await client.query(sql);
      return result.rows;
    });

    const options = rows
      .map((r: any) => String(r.value ?? '').trim())
      .filter((v: string) => v !== '')
      .map((v: string) => ({ label: v, value: v }));

    return NextResponse.json({ options, total: options.length }, { status: 200 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to fetch options.' }, { status });
  }
}
