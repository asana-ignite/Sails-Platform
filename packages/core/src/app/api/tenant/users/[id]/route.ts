import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * PATCH /api/tenant/users/[id]
 * Allows Admins to update user details within their tenant scope.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    const { id } = params;

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Admin role
    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN' && caller.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, role, title, phone, isActive } = body;

    // 1. Fetch existing user to verify tenant ownership
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Security: Only allow updating users within the same tenant (unless SUPER_ADMIN)
    if (caller.role !== 'SUPER_ADMIN' && existingUser.tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Forbidden: Cannot update users in other tenants.' }, { status: 403 });
    }

    // 2. Perform Update
    const updatedUser = await db.user.update({
      where: { id },
      data: {
        email: email !== undefined ? email : undefined,
        name: name !== undefined ? name : undefined,
        role: role !== undefined ? role : undefined,
        title: title !== undefined ? title : undefined,
        phone: phone !== undefined ? phone : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    SchemaLogger.logSystemEvent({
      tenantId: existingUser.tenantId || caller.tenantId,
      userId: caller.id,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Update User',
      details: {
        id,
        changes: { email, name, role, title, phone, isActive },
        before: {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          title: existingUser.title,
          phone: existingUser.phone,
          isActive: existingUser.isActive
        }
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use by another account.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tenant/users/[id]
 * Allows Admins to remove users from their tenant.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    const { id } = params;

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN' && caller.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const userToDelete = await db.user.findUnique({ where: { id } });
    if (!userToDelete) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (caller.role !== 'SUPER_ADMIN' && userToDelete.tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent self-deletion of the current admin
    if (userToDelete.id === caller.id) {
      return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 });
    }

    await db.user.delete({ where: { id } });

    SchemaLogger.logSystemEvent({
      tenantId: userToDelete.tenantId || caller.tenantId,
      userId: caller.id,
      category: 'USER_MANAGEMENT',
      action: 'DELETE',
      eventName: 'Delete User',
      details: { id, email: userToDelete.email, name: userToDelete.name }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
