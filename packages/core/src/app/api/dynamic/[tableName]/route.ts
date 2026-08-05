import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { QueryLayer, FilterGroupRule } from '@/core/engine/QueryLayer';
import { resolveContextMacro } from '@/core/engine/contextMacros';
import format from 'pg-format';
import { requireSession } from '@/lib/auth/session';
import { validateRecord, sanitizeWritePayload } from '@sails/shared';

type RouteContext = { params: { tableName: string } };

/**
 * Shared helper: look up the physical table definition and validate tenant ownership.
 * Returns the schemaName for the active session's tenant.
 */
async function resolveTable(tableName: string) {
  const { tenantId } = await requireSession();

  const table = await db.tableDefinition.findFirst({
    where: {
      tableName,
      tenantId,
    },
    include: {
      tenant: true,
      fields: {
        include: { rules: true },
      },
      rules: true,
    },
  });

  if (!table) {
    return null;
  }

  return { table, schemaName: table.tenant.schemaName };
}

// ---------------------------------------------------------------------------
// POST /api/dynamic/[tableName] — Create a record
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const rawData = await req.json();

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    const data = sanitizeWritePayload(resolved.table.fields, rawData);

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No data provided.' }, { status: 400 });
    }

    // Server-side validation (metadata config: isRequired, min/max, maxLength).
    const issues = validateRecord(resolved.table.fields, data);
    if (issues.length > 0) {
      return NextResponse.json({ error: 'Validation failed', issues }, { status: 422 });
    }

    // QueryLayer handles: AccessGuard (RBAC) → TransactionContext (RLS) → Audit Log
    const newRecord = await QueryLayer.insertRecord(
      pool,
      resolved.schemaName,
      tableName,
      data
    );

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to insert record.' }, { status });
  }
}

// ---------------------------------------------------------------------------
// GET /api/dynamic/[tableName] — List records with server-side filter/sort/page
//
// Query parameters:
//   ?search=text        — ILIKE across text/varchar fields
//   ?filters=<json>     — {"status":"active","name:contains":"john","age:gt":"18"}
//   ?sort=<json>        — [{"fieldId":"name","dir":"asc"}]
//   ?page=1&limit=25    — pagination (default 1, 25; max 100)
//   ?id=<recordId>      — single-record lookup (detail page)
//
// Every field name is validated against tableDefinition.fields before use.
// Both SELECT and COUNT run inside executeSecureQuery for RLS enforcement.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const { searchParams } = req.nextUrl;

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    const recordId = searchParams.get('id');

    if (recordId) {
      const tableMeta = resolved.table;

      const rows = await QueryLayer.executeSecureQuery(
        pool,
        tableName,
        'read',
        async (client) => {
          const sql = format(
            'SELECT * FROM %I.%I WHERE id = %L',
            resolved.schemaName,
            tableName,
            recordId
          );
          const result = await client.query(sql);
          return result.rows;
        }
      );

      return NextResponse.json(
        { rows, total: rows.length, page: 1, limit: 1, totalPages: 1, fields: tableMeta?.fields || [] },
        { status: 200 }
      );
    }

    const tableMeta = resolved.table;

    const validFields = new Set<string>(
      (tableMeta?.fields || []).map((f: any) => f.fieldName)
    );

    const textTypes = new Set(['text', 'varchar', 'string', 'char', 'email', 'phone', 'url', 'description']);
    const textFields = (tableMeta?.fields || [])
      .filter((f: any) => textTypes.has(f.type?.toLowerCase() || ''))
      .map((f: any) => f.fieldName);

    const jsonbFields = new Set<string>(
      (tableMeta?.fields || [])
        .filter((f: any) => (f.physicalType || '').toLowerCase() === 'jsonb')
        .map((f: any) => f.fieldName)
    );

    const filtersRaw = searchParams.get('filters');
    const filterGroupsRaw = searchParams.get('filterGroups');
    const sortRaw = searchParams.get('sort');

    let filters: Record<string, string> | undefined;
    let filterGroups: { groupLogic: 'and' | 'or'; rules: FilterGroupRule[] }[] | undefined;
    let sort: { fieldId: string; dir: 'asc' | 'desc' }[] | undefined;

    if (filtersRaw) {
      try { filters = JSON.parse(filtersRaw); } catch { /* ignore malformed JSON */ }
    }
    if (filterGroupsRaw) {
      try {
        const parsed = JSON.parse(filterGroupsRaw);
        if (Array.isArray(parsed)) filterGroups = parsed;
      } catch { /* ignore malformed JSON */ }
    }
    if (sortRaw) {
      try {
        const parsed = JSON.parse(sortRaw);
        if (Array.isArray(parsed)) sort = parsed;
      } catch { /* ignore malformed JSON */ }
    }

    // Preprocess grouped filters:
    //  - validate LHS/refField columns against the model's fields
    //  - resolve LHS/RHS drill chains into per-hop table names
    //  - resolve context macros (@me, @today, ...) using the session
    //  - resolve record-source subquery table from the relation field config
    if (filterGroups && filterGroups.length > 0) {
      const session = await requireSession();
      const tableFields = (tableMeta?.fields || []) as any[];
      const fieldByName = new Map(tableFields.map((f: any) => [f.fieldName, f]));

      // Related-table metadata cache for drill-chain resolution (per request).
      const tableCache = new Map<string, any[]>();
      tableCache.set(tableName, tableFields);
      const loadTableFields = async (tName: string): Promise<any[] | null> => {
        if (tableCache.has(tName)) return tableCache.get(tName) || null;
        const t = await db.tableDefinition.findFirst({
          where: { tenantId: session.tenantId, tableName: tName },
          include: { fields: true },
        });
        const flds = (t?.fields || []) as any[];
        tableCache.set(tName, flds);
        return flds.length > 0 ? flds : null;
      };

      // Resolve a drill chain [c0, c1, ...] into per-hop table names.
      // chain[0] lives on the root table; chain[i] (i>0) must be a field of the
      // table targeted by relation field chain[i-1].
      const resolveChain = async (chain: string[]): Promise<string[] | null> => {
        if (!Array.isArray(chain) || chain.length === 0) return null;
        const tables: string[] = [tableName];
        let curFields = tableFields;
        if (!curFields.some((f: any) => f.fieldName === chain[0])) return null;
        for (let i = 1; i < chain.length; i++) {
          const relField = curFields.find((f: any) => f.fieldName === chain[i - 1]);
          const lt = relField?.logicalType;
          const target = relField && (lt === 'relation' || lt === 'lookup') ? (relField.config as any)?.targetTable : null;
          if (!target) return null;
          const nextFields = await loadTableFields(target);
          if (!nextFields || !nextFields.some((f: any) => f.fieldName === chain[i])) return null;
          tables.push(target);
          curFields = nextFields;
        }
        return tables;
      };

      for (const grp of filterGroups) {
        if (!grp || !Array.isArray(grp.rules)) continue;
        for (const rule of grp.rules) {
          if (!rule) continue;
          const isChainRule = Array.isArray(rule.chain) && rule.chain.length > 0;

          if (isChainRule) {
            const tables = await resolveChain(rule.chain);
            if (!tables) { rule.value = ''; continue; }
            rule.chainTables = tables;
          } else if (!validFields.has(rule.field)) {
            rule.value = '';
            continue;
          }

          // RHS field-source drill chain (drilled deeper than one hop).
          if (Array.isArray(rule.refChain) && rule.refChain.length > 1) {
            const refTables = await resolveChain(rule.refChain);
            if (!refTables) { rule.value = ''; continue; }
            rule.refChainTables = refTables;
          }

          // Field-to-field (single hop): refField must be a valid root column.
          if (rule.refField && !rule.refRecordId && !Array.isArray(rule.refChain) && !validFields.has(rule.refField)) {
            rule.value = '';
            continue;
          }

          // Record source: resolve the related table from the LHS relation field.
          if (rule.refField && rule.refRecordId) {
            const lhsCol = isChainRule && rule.chain ? rule.chain[0] : rule.field;
            const lhsFieldMeta = fieldByName.get(lhsCol) || tableFields.find((f: any) => f.fieldName === lhsCol);
            const targetTable = (lhsFieldMeta?.config as any)?.targetTable || '';
            if (!targetTable) {
              rule.value = '';
              continue;
            }
            rule.targetTable = targetTable;
          }

          // Context macros resolve to concrete values before SQL generation.
          if (typeof rule.value === 'string' && rule.value.startsWith('@')) {
            rule.value = resolveContextMacro(rule.value, rule.contextN, {
              userId: session.userId,
              teams: session.teams,
              role: session.role,
            });
          }
        }
      }
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const result = await QueryLayer.listRecords(pool, resolved.schemaName, tableName, {
      filters,
      filterGroups,
      search: searchParams.get('search') || undefined,
      sort,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 25 : limit,
      validFields,
      textFields,
      jsonbFields,
    });

    return NextResponse.json(
      { ...result, fields: tableMeta?.fields || [] },
      { status: 200 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to fetch records.' }, { status });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/dynamic/[tableName]?id=<recordId> — Update a record
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const recordId = req.nextUrl.searchParams.get('id');
    const rawData = await req.json();

    if (!recordId) {
      return NextResponse.json({ error: 'Missing required query param: id.' }, { status: 400 });
    }

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    const data = sanitizeWritePayload(resolved.table.fields, rawData);

    // Server-side validation for partial updates — only fields present in the body.
    const patchFields = (resolved.table.fields || []).filter((f: any) =>
      Object.prototype.hasOwnProperty.call(data, f.fieldName)
    );
    const issues = validateRecord(patchFields, data);
    if (issues.length > 0) {
      return NextResponse.json({ error: 'Validation failed', issues }, { status: 422 });
    }

    const updatedRecord = await QueryLayer.updateRecord(
      pool,
      resolved.schemaName,
      tableName,
      recordId,
      data
    );

    return NextResponse.json(updatedRecord, { status: 200 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to update record.' }, { status });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/dynamic/[tableName]?id=<recordId> — Delete a record
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const recordId = req.nextUrl.searchParams.get('id');

    if (!recordId) {
      return NextResponse.json({ error: 'Missing required query param: id.' }, { status: 400 });
    }

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    await QueryLayer.deleteRecord(
      pool,
      resolved.schemaName,
      tableName,
      recordId
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to delete record.' }, { status });
  }
}

