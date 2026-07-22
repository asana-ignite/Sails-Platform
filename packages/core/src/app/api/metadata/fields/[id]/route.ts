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

    const isDeveloperBypass = req.headers.get('x-klao-system-bypass') === 'true'
      || (process.env.NODE_ENV === 'development' && process.env.KLAO_DEVELOPER_MODE === 'true');

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
    const session = await getAppSession();
    const caller = session?.user as any;
    
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const isDeveloperBypass = req.headers.get('x-klao-system-bypass') === 'true'
      || (process.env.NODE_ENV === 'development' && process.env.KLAO_DEVELOPER_MODE === 'true');

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
