import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';
import { countInstancesForDefinition } from '@/core/engine/WorkflowEngine';

/**
 * Workflow Definition API — versioned approval-workflow definitions.
 *
 * Lifecycle (mirrors console/layouts draft/active pattern):
 *   draft ──activate──▶ active (publishes WorkflowVersion snapshot)
 *   active ──start-edit──▶ draft
 *   draft ──discard-draft──▶ active (revert to publishedConfig)
 *   active ──rollback(targetVersion)──▶ draft (copy version config)
 *   any ──deactivate──▶ deactivated (soft delete; instances keep running)
 *
 * Running instances pin to a WorkflowVersion snapshot — activating a new
 * version never changes in-flight instances.
 */

async function resolveDefinition(idOrSystemName: string, tenantId: string) {
  const def = await db.workflowDefinition.findFirst({
    where: { OR: [{ id: idOrSystemName }, { systemName: idOrSystemName }] },
  });
  if (!def) return null;
  if (def.tenantId !== tenantId) return null;
  return def;
}

function assertOwned(def: any, tenantId: string): boolean {
  return !!def && def.tenantId === tenantId;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const def = await resolveDefinition(id, tenantId);
      if (!def) {
        return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 });
      }
      const versions = await db.workflowVersion.findMany({
        where: { defId: def.id },
        orderBy: { version: 'desc' },
      });
      return NextResponse.json({ success: true, data: { ...def, versions } });
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status'); // draft | active | deactivated
    const tableId = searchParams.get('tableId');

    const where: any = { tenantId };
    if (tableId) {
      const table = await db.tableDefinition.findFirst({
        where: { OR: [{ id: tableId }, { tableName: tableId }], tenantId },
      });
      if (!table) {
        return NextResponse.json({ success: false, error: 'Table not found or access denied' }, { status: 404 });
      }
      where.tableId = table.id;
    }
    if (search) {
      where.AND = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { systemName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    if (statusFilter) {
      where.status = statusFilter;
    }

    const [rows, total] = await Promise.all([
      db.workflowDefinition.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          table: { select: { id: true, name: true, tableName: true } },
          _count: { select: { versions: true } },
        },
      }),
      db.workflowDefinition.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { rows, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('[API WORKFLOWS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let submittedSystemName: string | undefined;
  try {
    const { tenantId } = await requireSession();
    const body = await req.json();
    const { name, systemName, description, tableId, config, isDefault } = body;
    submittedSystemName = systemName;

    if (!name || !systemName) {
      return NextResponse.json({ success: false, error: 'name and systemName are required' }, { status: 400 });
    }

    if (tableId) {
      const table = await db.tableDefinition.findUnique({ where: { id: tableId, tenantId } });
      if (!table) {
        return NextResponse.json({ success: false, error: 'Table not found or access denied' }, { status: 404 });
      }
    }

    if (isDefault && tableId) {
      await db.workflowDefinition.updateMany({
        where: { tenantId, tableId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const def = await db.workflowDefinition.create({
      data: {
        tenantId,
        name,
        systemName,
        description,
        tableId: tableId || null,
        isDefault: isDefault || false,
        config: config || { stages: [], branches: [], events: [], variables: [] },
        status: 'draft',
        currentVersion: 1,
        publishedConfig: null,
      },
    });

    return NextResponse.json({ success: true, data: def });
  } catch (error: any) {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(',') : '';
    if (error?.code === 'P2002' && target.includes('system_name')) {
      return NextResponse.json({
        success: false,
        error: `A workflow with system name "${submittedSystemName}" already exists. Please use a different name.`,
      }, { status: 409 });
    }
    console.error('[API WORKFLOWS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId, userId } = await requireSession();
    const body = await req.json();
    const { id, action, name, systemName, description, tableId, config, isDefault, notes, targetVersion } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Workflow ID is required' }, { status: 400 });
    }

    const existing = await resolveDefinition(id, tenantId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 });
    }
    if (!assertOwned(existing, tenantId)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // ── Action dispatch ──
    if (action === 'start-edit') {
      if (existing.status !== 'active') {
        return NextResponse.json({ success: false, error: 'Only active workflows can be edited' }, { status: 400 });
      }
      if (!existing.publishedConfig) {
        return NextResponse.json({ success: false, error: 'No published config to start editing from' }, { status: 400 });
      }
      const updated = await db.workflowDefinition.update({
        where: { id },
        data: { config: existing.publishedConfig as any, status: 'draft' },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'activate') {
      const activeConfig = config !== undefined ? config : (existing.config || existing.publishedConfig);
      const updated = await db.$transaction(async (tx) => {
        // Next version = max(currentVersion, max existing version + 1) — robust
        // against backfilled snapshots that predate the counter.
        const latest = await tx.workflowVersion.findFirst({
          where: { defId: id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const nextVersion = Math.max(existing.currentVersion, (latest?.version || 0) + 1);
        const def = await tx.workflowDefinition.update({
          where: { id },
          data: {
            config: activeConfig as any,
            publishedConfig: activeConfig as any,
            status: 'active',
            currentVersion: nextVersion + 1,
            ...(isDefault !== undefined ? { isDefault } : {}),
          },
        });
        await tx.workflowVersion.create({
          data: {
            defId: id,
            version: nextVersion,
            config: activeConfig as any,
            notes: notes || null,
            publishedBy: userId || null,
          },
        });
        return def;
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'discard-draft') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ success: false, error: 'Only draft workflows can discard changes' }, { status: 400 });
      }
      if (!existing.publishedConfig) {
        return NextResponse.json({ success: false, error: 'No published version to revert to' }, { status: 400 });
      }
      const updated = await db.workflowDefinition.update({
        where: { id },
        data: { config: existing.publishedConfig as any, status: 'active' },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'rollback') {
      if (!targetVersion) {
        return NextResponse.json({ success: false, error: 'targetVersion is required for rollback' }, { status: 400 });
      }
      const target = await db.workflowVersion.findUnique({
        where: { defId_version: { defId: id, version: Number(targetVersion) } },
      });
      if (!target) {
        return NextResponse.json({ success: false, error: `Version ${targetVersion} not found` }, { status: 404 });
      }
      const updated = await db.workflowDefinition.update({
        where: { id },
        data: { config: target.config as any, status: 'draft' },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'deactivate') {
      const updated = await db.workflowDefinition.update({
        where: { id },
        data: { status: 'deactivated', deactivatedAt: new Date(), deactivatedBy: userId || null },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // ── Regular update (metadata + draft save) ──
    if (existing.status === 'active' && config !== undefined) {
      return NextResponse.json({
        success: false,
        error: 'This workflow is currently active. Click "Edit" to start editing before modifying the config.',
      }, { status: 400 });
    }

    if (tableId) {
      const table = await db.tableDefinition.findUnique({ where: { id: tableId, tenantId } });
      if (!table) {
        return NextResponse.json({ success: false, error: 'Table not found or access denied' }, { status: 404 });
      }
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (systemName !== undefined) data.systemName = systemName;
    if (description !== undefined) data.description = description;
    if (tableId !== undefined) data.tableId = tableId || null;
    if (isDefault !== undefined) data.isDefault = isDefault;
    if (config !== undefined) data.config = config;

    if (isDefault && tableId) {
      await db.workflowDefinition.updateMany({
        where: { tenantId, tableId: tableId || existing.tableId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await db.workflowDefinition.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[API WORKFLOWS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { tenantId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Workflow ID is required' }, { status: 400 });
    }

    const existing = await resolveDefinition(id, tenantId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 });
    }
    if (!assertOwned(existing, tenantId)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Instances pin to WorkflowVersion rows — deleting a definition whose
    // versions are still referenced by running instances is blocked.
    const runningCount = await countInstancesForDefinition(tenantId, existing.id);
    if (runningCount > 0) {
      return NextResponse.json({
        success: false,
        error: `${runningCount} instance(s) are still running on this workflow. Deactivate it instead — running instances continue on their pinned version.`,
      }, { status: 409 });
    }

    await db.workflowDefinition.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error: any) {
    console.error('[API WORKFLOWS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
