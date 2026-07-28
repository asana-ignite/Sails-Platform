import { NextRequest, NextResponse } from 'next/server';
import { getTranslator } from '@/lib/services';
import { getAppSession } from '@/lib/auth/session';

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

    const { name, description } = await req.json();
    const updated = await getTranslator().updateTable(params.id, name, description);
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
    const session = await getAppSession();
    const caller = session?.user as any;
    
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

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
