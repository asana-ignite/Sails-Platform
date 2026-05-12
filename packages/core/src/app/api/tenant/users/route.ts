import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

/**
 * POST /api/tenant/users
 * Allows Tenant Admins or Super Admins to provision new users within their tenant scope.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Admin role (SUPER_ADMIN or TENANT_ADMIN)
    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, role, teamId, title, phone } = body;

    if (!email) {
      return NextResponse.json({ error: 'Missing required field: email.' }, { status: 400 });
    }

    // Forced Multi-tenancy: New users are locked to the caller's tenantId 
    // unless the caller is a SUPER_ADMIN (who might provision across tenants).
    const targetTenantId = caller.role === 'SUPER_ADMIN' ? body.tenantId || caller.tenantId : caller.tenantId;

    if (!targetTenantId) {
       return NextResponse.json({ error: 'Could not determine tenant context.' }, { status: 400 });
    }

    const newUser = await db.user.create({
      data: {
        email,
        name,
        role: role || 'MEMBER',
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
    const session = await getAppSession();
    const caller = session?.user as any;

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Admin role (SUPER_ADMIN or TENANT_ADMIN)
    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN' && caller.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const targetTenantId = caller.tenantId;

    if (!targetTenantId) {
       return NextResponse.json({ error: 'Could not determine tenant context.' }, { status: 400 });
    }

    const users = await db.user.findMany({
      where: { tenantId: targetTenantId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
