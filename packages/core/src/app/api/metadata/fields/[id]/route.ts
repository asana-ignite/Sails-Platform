import { NextRequest, NextResponse } from 'next/server';
import { getTranslator } from '@/lib/services';
import { getAppSession } from '@/lib/auth/session';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    await getTranslator().removeFieldDef(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting field:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete field' },
      { status: 500 }
    );
  }
}
