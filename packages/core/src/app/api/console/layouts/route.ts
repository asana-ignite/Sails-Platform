import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireSession();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      const layout = await db.tableLayout.findFirst({
        where: { OR: [{ id }, { systemName: id }] },
        include: {
          table: { select: { id: true, name: true, tableName: true } }
        }
      });
      if (!layout) {
        return NextResponse.json({ success: false, error: 'Layout not found' }, { status: 404 });
      }
      if (layout.tableId) {
        const table = await db.tableDefinition.findUnique({ where: { id: layout.tableId, tenantId } });
        if (!table) {
          return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }
      }
      return NextResponse.json({ success: true, data: layout });
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status'); // 'draft' | 'active'
    const tableId = searchParams.get('tableId');

    const where: any = {};

    if (tableId) {
      const targetTable = await db.tableDefinition.findFirst({
        where: { OR: [{ id: tableId }, { tableName: tableId }], tenantId }
      });
      if (!targetTable) {
        return NextResponse.json({ success: false, error: 'Table not found or access denied' }, { status: 404 });
      }
      where.tableId = targetTable.id;
    } else {
      where.OR = [
        { table: { tenantId } },
        { tableId: null }
      ];
    }
    if (search) {
      where.AND = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { systemName: { contains: search, mode: 'insensitive' } },
          { table: { name: { contains: search, mode: 'insensitive' } } }
        ]
      };
    }
    if (statusFilter === 'draft' || statusFilter === 'active') {
      where.status = statusFilter;
    }

    const [rows, total] = await Promise.all([
      db.tableLayout.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          table: { select: { id: true, name: true, tableName: true } }
        }
      }),
      db.tableLayout.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('[API CONSOLE LAYOUTS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let submittedSystemName: string | undefined;
  try {
    const { tenantId } = await requireSession();

    const body = await req.json();
    const { tableId, layoutType, viewType, name, systemName, description, isDefault, recordTitleField, config } = body;
    submittedSystemName = systemName;

    if (!viewType || !name || !systemName) {
      return NextResponse.json({ success: false, error: 'viewType, name, and systemName are required' }, { status: 400 });
    }

    const resolvedLayoutType = layoutType || 'data';

    if (tableId) {
      const table = await db.tableDefinition.findUnique({
        where: { id: tableId, tenantId }
      });
      if (!table) {
        return NextResponse.json({ success: false, error: 'Table not found or access denied' }, { status: 404 });
      }
    }

    if (isDefault && tableId) {
      await db.tableLayout.updateMany({
        where: { tableId, viewType, isDefault: true },
        data: { isDefault: false }
      });
    }

    const layout = await db.tableLayout.create({
      data: {
        tableId: tableId || null,
        layoutType: resolvedLayoutType,
        viewType,
        name,
        systemName,
        description,
        isDefault: isDefault || false,
        recordTitleField,
        config: config || { sections: [], fields: [] },
        status: 'draft',
        publishedConfig: null,
      },
      include: {
        table: { select: { id: true, name: true, tableName: true } }
      }
    });

    return NextResponse.json({ success: true, data: layout });
  } catch (error: any) {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(',') : '';
    if (error?.code === 'P2002' && target.includes('system_name')) {
      return NextResponse.json({
        success: false,
        error: `A layout with system name "${submittedSystemName}" already exists for this model. Please use a different name.`,
      }, { status: 409 });
    }
    console.error('[API CONSOLE LAYOUTS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  let submittedSystemName: string | undefined;
  try {
    const { tenantId } = await requireSession();

    const body = await req.json();
    const { id, action, tableId, layoutType, viewType, name, systemName, description, isDefault, recordTitleField, config } = body;
    submittedSystemName = systemName;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Layout ID is required' }, { status: 400 });
    }

    const existing = await db.tableLayout.findFirst({
      where: { id }
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Layout not found' }, { status: 404 });
    }

    if (existing.tableId) {
      const table = await db.tableDefinition.findUnique({
        where: { id: existing.tableId, tenantId }
      });
      if (!table) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    // ── Action dispatch ──
    if (action === 'start-edit') {
      if (existing.status !== 'active') {
        return NextResponse.json({ success: false, error: 'Only active layouts can be edited' }, { status: 400 });
      }
      if (!existing.publishedConfig) {
        return NextResponse.json({ success: false, error: 'No published config to start editing from' }, { status: 400 });
      }
      const updated = await db.tableLayout.update({
        where: { id },
        data: {
          config: existing.publishedConfig as any,
          status: 'draft',
        },
        include: {
          table: { select: { id: true, name: true, tableName: true } }
        }
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'activate') {
      const activeConfig = config !== undefined ? config : (existing.config || existing.publishedConfig);
      const updated = await db.tableLayout.update({
        where: { id },
        data: {
          config: activeConfig as any,
          publishedConfig: activeConfig as any,
          status: 'active',
          ...(recordTitleField !== undefined ? { recordTitleField: recordTitleField || null } : {}),
        },
        include: {
          table: { select: { id: true, name: true, tableName: true } }
        }
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'discard-draft') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ success: false, error: 'Only draft layouts can discard changes' }, { status: 400 });
      }
      if (!existing.publishedConfig) {
        return NextResponse.json({ success: false, error: 'No published version to revert to' }, { status: 400 });
      }
      const updated = await db.tableLayout.update({
        where: { id },
        data: {
          config: existing.publishedConfig as any,
          status: 'active',
        },
        include: {
          table: { select: { id: true, name: true, tableName: true } }
        }
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // ── Regular update (metadata-only or draft save) ──
    if (existing.status === 'active' && config !== undefined) {
      return NextResponse.json({
        success: false,
        error: 'This layout is currently active. Click "Edit" to start editing before modifying the config.',
      }, { status: 400 });
    }

    const data: any = {};
    if (tableId !== undefined) data.tableId = tableId || null;
    if (layoutType !== undefined) data.layoutType = layoutType;
    if (viewType !== undefined) data.viewType = viewType;
    if (name !== undefined) data.name = name;
    if (systemName !== undefined) data.systemName = systemName;
    if (description !== undefined) data.description = description;
    if (isDefault !== undefined) data.isDefault = isDefault;
    if (recordTitleField !== undefined) data.recordTitleField = recordTitleField;
    if (config !== undefined) data.config = config;

    if (isDefault && isDefault !== existing.isDefault) {
      const targetTableId = tableId !== undefined ? tableId : existing.tableId;
      if (targetTableId) {
        await db.tableLayout.updateMany({
          where: { tableId: targetTableId, viewType: viewType || existing.viewType, isDefault: true, id: { not: id } },
          data: { isDefault: false }
        });
      }
    }

    const updated = await db.tableLayout.update({
      where: { id },
      data,
      include: {
        table: { select: { id: true, name: true, tableName: true } }
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(',') : '';
    if (error?.code === 'P2002' && target.includes('system_name')) {
      return NextResponse.json({
        success: false,
        error: `A layout with system name "${submittedSystemName}" already exists for this model. Please use a different name.`,
      }, { status: 409 });
    }
    console.error('[API CONSOLE LAYOUTS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { tenantId } = await requireSession();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Layout ID is required' }, { status: 400 });
    }

    const existing = await db.tableLayout.findFirst({
      where: { id }
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Layout not found' }, { status: 404 });
    }

    if (existing.tableId) {
      const table = await db.tableDefinition.findUnique({
        where: { id: existing.tableId, tenantId }
      });
      if (!table) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    await db.tableLayout.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Layout deleted successfully' });
  } catch (error: any) {
    console.error('[API CONSOLE LAYOUTS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
