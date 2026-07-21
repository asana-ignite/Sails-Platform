import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTranslator } from '@/lib/services';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

export async function POST(req: NextRequest) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const { name, tableName, description } = await req.json();

    // Create the table via the translator (handles DDL and Metadata)
    const table = await getTranslator().createTable(
      caller.tenantId,
      name,
      tableName,
      description
    );

    // Log Logical Metadata Event
    SchemaLogger.logSystemEvent({
      tenantId: caller.tenantId,
      userId: caller.id,
      category: 'METADATA',
      action: 'CREATE',
      eventName: 'Create Table Definition',
      details: { id: table.id, name, tableName, description }
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error: any) {
    console.error('Error creating table metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create table' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const tables = await db.tableDefinition.findMany({
      where: {
        tenantId: caller.tenantId
      },
      include: {
        tenant: true,
        fields: true,
        _count: {
          select: { fields: true }
        }
      }
    });
    return NextResponse.json(tables);
  } catch (error: any) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
}
