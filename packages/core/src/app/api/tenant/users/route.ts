import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * POST /api/tenant/users
 * Allows Tenant Admins or Super Admins to provision new users within their tenant scope.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, tenantId, role, email } = await requireAdmin();
    const body = await req.json();
    const { email: newEmail, name, role: newRole, teamId, title, phone } = body;

    if (!newEmail) {
      return NextResponse.json({ error: 'Missing required field: email.' }, { status: 400 });
    }

    // Forced Multi-tenancy: New users are locked to the caller's tenantId
    // unless the caller is a SUPER_ADMIN (who might provision across tenants).
    const targetTenantId = role === 'SUPER_ADMIN' ? body.tenantId || tenantId : tenantId;

    if (!targetTenantId) {
       return NextResponse.json({ error: 'Could not determine tenant context.' }, { status: 400 });
    }

    const newUser = await db.user.create({
      data: {
        email: newEmail,
        name,
        role: newRole || 'MEMBER',
        title: title || '',
        phone: phone || '',
        tenantId: targetTenantId,
        teams: teamId ? {
          create: {
            teamId: teamId,
            isLeader: false
          }
        } : undefined
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId: targetTenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'CREATE',
      eventName: 'Create User',
      details: { id: newUser.id, email: newEmail, name, role: newRole, title, phone }
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    // Handle Prisma unique constraint errors for duplicate emails
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/tenant/users
 * Returns all users within the caller's tenant scope.
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId, role } = await requireSession();

    // Verify Admin role (SUPER_ADMIN or TENANT_ADMIN or ADMIN)
    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    if (!tenantId) {
       return NextResponse.json({ error: 'Could not determine tenant context.' }, { status: 400 });
    }

    const users = await db.user.findMany({
      where: { tenantId },
      include: {
        positionSlots: {
          include: {
            position: true
          }
        },
        teams: {
          include: {
            team: true
          }
        },
        objectPermissions: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
