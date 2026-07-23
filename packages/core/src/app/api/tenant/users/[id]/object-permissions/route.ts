import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * GET /api/tenant/users/[id]/object-permissions
 * Get user object permissions.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = params.id;
    const permissions = await db.objectPermission.findMany({
      where: { userId }
    });

    return NextResponse.json(permissions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/tenant/users/[id]/object-permissions
 * Upsert object permission for a user.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    const userId = params.id;

    if (!caller || (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetTenantId = caller.tenantId;
    const { objectName, canCreate, canDelete, readScope, modifyScope } = await req.json();

    if (!objectName) {
      return NextResponse.json({ error: 'objectName is required' }, { status: 400 });
    }

    const existingPerm = await db.objectPermission.findFirst({
      where: { userId, objectName }
    });

    let permission;
    if (existingPerm) {
      permission = await db.objectPermission.update({
        where: { id: existingPerm.id },
        data: {
          canCreate: canCreate ?? false,
          canDelete: canDelete ?? false,
          readScope: readScope ?? 'NONE',
          modifyScope: modifyScope ?? 'NONE'
        }
      });
    } else {
      permission = await db.objectPermission.create({
        data: {
          tenantId: targetTenantId,
          userId,
          objectName,
          canCreate: canCreate ?? false,
          canDelete: canDelete ?? false,
          readScope: readScope ?? 'NONE',
          modifyScope: modifyScope ?? 'NONE'
        }
      });
    }

    SchemaLogger.logSystemEvent({
      tenantId: targetTenantId,
      userId: caller.id,
      category: 'SETTINGS',
      action: 'UPDATE',
      eventName: 'Update User Object Permission',
      details: { targetUserId: userId, objectName, permissions: permission }
    });

    return NextResponse.json(permission, { status: 200 });
  } catch (error: any) {
    console.error('Error upserting user object permission:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
