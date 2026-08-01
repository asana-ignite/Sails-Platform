import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTranslator } from '@/lib/services';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { userId, tenantId, role } = await requireAdmin();

    const fieldId = params.id;
    const body = await req.json().catch(() => ({}));
    const nextValue = Number(body.nextValue) || 1;

    // Verify the field exists and belongs to tenant
    const field = await db.fieldDefinition.findUnique({
      where: { id: fieldId },
      include: { table: true }
    });

    if (!field || (role !== 'SUPER_ADMIN' && field.table.tenantId !== tenantId)) {
      return NextResponse.json({ error: 'Field not found or access denied.' }, { status: 404 });
    }

    const updatedField = await getTranslator().resetFieldSequence(fieldId, nextValue);

    SchemaLogger.logSystemEvent({
      tenantId: tenantId,
      userId: userId,
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
