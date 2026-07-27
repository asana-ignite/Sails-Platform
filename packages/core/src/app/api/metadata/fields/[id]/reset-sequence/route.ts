import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTranslator } from '@/lib/services';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const fieldId = params.id;
    const body = await req.json().catch(() => ({}));
    const nextValue = Number(body.nextValue) || 1;

    // Verify the field exists and belongs to tenant
    const field = await db.fieldDefinition.findUnique({
      where: { id: fieldId },
      include: { table: true }
    });

    if (!field || (caller.role !== 'SUPER_ADMIN' && field.table.tenantId !== caller.tenantId)) {
      return NextResponse.json({ error: 'Field not found or access denied.' }, { status: 404 });
    }

    const updatedField = await getTranslator().resetFieldSequence(fieldId, nextValue);

    SchemaLogger.logSystemEvent({
      tenantId: caller.tenantId,
      userId: caller.id,
      category: 'METADATA',
      action: 'UPDATE',
      eventName: 'Reset Field Sequence',
      details: { fieldId, fieldName: field.fieldName, nextValue }
    });

    return NextResponse.json(updatedField, { status: 200 });
  } catch (error: any) {
    console.error('Error resetting field sequence:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset sequence' },
      { status: 500 }
    );
  }
}
