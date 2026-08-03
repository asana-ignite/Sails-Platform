import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { QueryLayer } from '@/core/engine/QueryLayer';
import format from 'pg-format';
import { requireSession } from '@/lib/auth/session';
import { validateRecord } from '@sails/shared';

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
    const data = await req.json();

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

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
    const sortRaw = searchParams.get('sort');

    let filters: Record<string, string> | undefined;
    let sort: { fieldId: string; dir: 'asc' | 'desc' }[] | undefined;

    if (filtersRaw) {
      try { filters = JSON.parse(filtersRaw); } catch { /* ignore malformed JSON */ }
    }
    if (sortRaw) {
      try {
        const parsed = JSON.parse(sortRaw);
        if (Array.isArray(parsed)) sort = parsed;
      } catch { /* ignore malformed JSON */ }
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const result = await QueryLayer.listRecords(pool, resolved.schemaName, tableName, {
      filters,
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
    const data = await req.json();

    if (!recordId) {
      return NextResponse.json({ error: 'Missing required query param: id.' }, { status: 400 });
    }

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

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

