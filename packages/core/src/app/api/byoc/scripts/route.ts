/**
 * BYOC scripts — list/upload custom JS modules that workflow 'script' events
 * run inside the sandbox (ScriptSandbox). Size-limited, metadata stored in
 * core.record_scripts.
 */
import { NextRequest, NextResponse } from 'next/server';
import vm from 'node:vm';
import { db } from '@/lib/db';
import { requireSession, requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';
import { MAX_SCRIPT_BYTES } from '@/core/engine/WorkflowHelpers';

function validateScriptCode(code: string): string | null {
  if (!code || !code.trim()) return 'scriptCode is required';
  if (Buffer.byteLength(code, 'utf8') > MAX_SCRIPT_BYTES) {
    return `scriptCode exceeds ${MAX_SCRIPT_BYTES} bytes`;
  }
  try {
    new vm.Script(code, { filename: 'byoc-script.js' });
  } catch (error: any) {
    return `Syntax error: ${error?.message || error}`;
  }
  return null;
}

/**
 * GET /api/byoc/scripts — list tenant scripts (session required).
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const script = await db.recordScript.findFirst({ where: { id, tenantId } });
      if (!script) {
        return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: script });
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const activeOnly = searchParams.get('active') === 'true';

    const where: any = { tenantId };
    if (activeOnly) where.isActive = true;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [rows, total] = await Promise.all([
      db.recordScript.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, description: true, isActive: true,
          createdAt: true, updatedAt: true,
        },
      }),
      db.recordScript.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { rows, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('[API BYOC SCRIPTS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/byoc/scripts — create a script (admin required).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const body = await req.json();
    const { name, description, scriptCode } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    const syntaxError = validateScriptCode(scriptCode);
    if (syntaxError) {
      return NextResponse.json({ success: false, error: syntaxError }, { status: 400 });
    }

    const script = await db.recordScript.create({
      data: { tenantId, name: name.trim(), description: description || null, scriptCode },
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'SETTINGS',
      action: 'CREATE',
      eventName: 'Create BYOC Script',
      details: { id: script.id, name: script.name },
    });

    return NextResponse.json({ success: true, data: script }, { status: 201 });
  } catch (error: any) {
    console.error('[API BYOC SCRIPTS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/byoc/scripts?id=... — update a script (admin required).
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Script ID is required' }, { status: 400 });
    }

    const existing = await db.recordScript.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
    }

    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ success: false, error: 'name cannot be empty' }, { status: 400 });
      data.name = body.name.trim();
    }
    if (body.description !== undefined) data.description = body.description;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.scriptCode !== undefined) {
      const syntaxError = validateScriptCode(body.scriptCode);
      if (syntaxError) {
        return NextResponse.json({ success: false, error: syntaxError }, { status: 400 });
      }
      data.scriptCode = body.scriptCode;
    }

    const updated = await db.recordScript.update({ where: { id }, data });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'SETTINGS',
      action: 'UPDATE',
      eventName: 'Update BYOC Script',
      details: { id: updated.id, name: updated.name },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[API BYOC SCRIPTS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/byoc/scripts?id=... — delete a script (admin required).
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Script ID is required' }, { status: 400 });
    }

    const existing = await db.recordScript.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 });
    }

    await db.recordScript.delete({ where: { id } });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'SETTINGS',
      action: 'DELETE',
      eventName: 'Delete BYOC Script',
      details: { id, name: existing.name },
    });

    return NextResponse.json({ success: true, message: 'Script deleted successfully' });
  } catch (error: any) {
    console.error('[API BYOC SCRIPTS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
