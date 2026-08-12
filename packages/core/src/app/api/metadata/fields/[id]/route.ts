/**
 * Field update/delete — TranslatorLayer handles type conversion audits,
 * layout pruning on delete, and Expression trigger lifecycle.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTranslator } from '@/lib/services';
import { requireAdmin } from '@/lib/auth/session';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const isDeveloperBypass = req.headers.get('x-sails-system-bypass') === 'true'
      || (process.env.NODE_ENV === 'development' && process.env.SAILS_DEVELOPER_MODE === 'true');

    await getTranslator().removeFieldDef(params.id, isDeveloperBypass);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting field:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete field' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const isDeveloperBypass = req.headers.get('x-sails-system-bypass') === 'true'
      || (process.env.NODE_ENV === 'development' && process.env.SAILS_DEVELOPER_MODE === 'true');

    const body = await req.json();
    const updatedField = await getTranslator().updateFieldDef(params.id, body, isDeveloperBypass);
    return NextResponse.json({ success: true, field: updatedField });
  } catch (error: any) {
    console.error('Error updating field:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update field' },
      { status: 500 }
    );
  }
}
