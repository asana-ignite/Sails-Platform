import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

export async function GET(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      const layout = await db.tableLayout.findFirst({
        where: { id },
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

    const where: any = {
      OR: [
        { table: { tenantId } },
        { tableId: null }
      ]
    };
    if (search) {
      where.AND = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { systemName: { contains: search, mode: 'insensitive' } },
          { table: { name: { contains: search, mode: 'insensitive' } } }
        ]
      };
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
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const body = await req.json();
    const { tableId, layoutType, viewType, name, systemName, description, isDefault, recordTitleField, config } = body;

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

    // If this is set as default, unset any existing default for the same table+viewType
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
        config: config || { sections: [], fields: [] }
      },
      include: {
        table: { select: { id: true, name: true, tableName: true } }
      }
    });

    return NextResponse.json({ success: true, data: layout });
  } catch (error: any) {
    console.error('[API CONSOLE LAYOUTS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const body = await req.json();
    const { id, tableId, layoutType, viewType, name, systemName, description, isDefault, recordTitleField, config } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Layout ID is required' }, { status: 400 });
    }

    const existing = await db.tableLayout.findFirst({
      where: { id }
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Layout not found' }, { status: 404 });
    }

    // Verify tenant access if the layout has a table
    if (existing.tableId) {
      const table = await db.tableDefinition.findUnique({
        where: { id: existing.tableId, tenantId }
      });
      if (!table) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    // If setting as default, unset existing defaults
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
      data: {
        ...(tableId !== undefined && { tableId: tableId || null }),
        ...(layoutType !== undefined && { layoutType }),
        ...(viewType !== undefined && { viewType }),
        ...(name !== undefined && { name }),
        ...(systemName !== undefined && { systemName }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        ...(recordTitleField !== undefined && { recordTitleField }),
        ...(config !== undefined && { config })
      },
      include: {
        table: { select: { id: true, name: true, tableName: true } }
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[API CONSOLE LAYOUTS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

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

    // Verify tenant access if the layout has a table
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
