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

    const { 
        tableId, 
        name, 
        fieldName, 
        physicalType, 
        logicalType, 
        config, 
        isRequired,
        description
    } = await req.json();

    // Verify the table belongs to the user's tenant
    const table = await db.tableDefinition.findUnique({
      where: { id: tableId }
    });

    if (!table || (caller.role !== 'SUPER_ADMIN' && table.tenantId !== caller.tenantId)) {
      return NextResponse.json({ error: 'Table not found or access denied' }, { status: 404 });
    }

    // Add the field via the translator (handles DDL and Metadata)
    const field = await getTranslator().addFieldDef(
        tableId,
        name,
        fieldName,
        physicalType,
        logicalType,
        config,
        isRequired,
        description
    );

    // Log Logical Metadata Event
    SchemaLogger.logSystemEvent({
      tenantId: caller.tenantId,
      userId: caller.id,
      category: 'METADATA',
      action: 'CREATE',
      eventName: 'Create Field Definition',
      details: { id: field.id, tableId, name, fieldName, physicalType, logicalType, isRequired, description }
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error: any) {
    console.error('Error creating field metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create field' },
      { status: 500 }
    );
  }
}
