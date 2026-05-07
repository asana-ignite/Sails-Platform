import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { QueryLayer } from '@/core/engine/QueryLayer';
import format from 'pg-format';
import { getAppSession } from '@/lib/auth/session';

type RouteContext = { params: { tableName: string } };

/**
 * Shared helper: look up the physical table definition and validate tenant ownership.
 * Returns the schemaName for the active session's tenant.
 */
async function resolveTable(tableName: string) {
  const session = await getAppSession();
  const tenantId = (session?.user as any)?.tenantId;

  const table = await db.tableDefinition.findFirst({
    where: {
      tableName,
      // Enforce tenant isolation at the metadata level too
      ...(tenantId ? { tenantId } : {}),
    },
    include: { tenant: true },
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
// GET /api/dynamic/[tableName] — List all records (scoped by RLS)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    // Use QueryLayer.executeSecureQuery for consistent AccessGuard + RLS enforcement
    const rows = await QueryLayer.executeSecureQuery(
      pool,
      tableName,
      'read',
      async (client) => {
        const sql = format(
          'SELECT * FROM %I.%I ORDER BY created_at DESC',
          resolved.schemaName,
          tableName
        );
        const result = await client.query(sql);
        return result.rows;
      }
    );

    return NextResponse.json(rows, { status: 200 });
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

