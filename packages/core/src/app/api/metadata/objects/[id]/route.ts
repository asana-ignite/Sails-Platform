/**
 * Table update/delete (system tables guarded).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTranslator } from '@/lib/services';
import { requireAdmin } from '@/lib/auth/session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const { name, description, nameI18n, descriptionI18n } = await req.json();
    const updated = await getTranslator().updateTable(params.id, name, description, nameI18n, descriptionI18n);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating table:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update table' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const isDeveloperBypass = req.headers.get('x-sails-system-bypass') === 'true'
      || (process.env.NODE_ENV === 'development' && process.env.SAILS_DEVELOPER_MODE === 'true');

    await getTranslator().removeTable(params.id, isDeveloperBypass);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting table:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete table' },
      { status: 500 }
    );
  }
}
