import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth/session';

async function resolveTenantId() {
  const ctx = await getSession();
  if (ctx?.tenantId) return ctx.tenantId;
  if (ctx?.userId) {
    const dbUser = await db.user.findUnique({ where: { id: ctx.userId }, select: { tenantId: true } });
    if (dbUser?.tenantId) return dbUser.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || null;
}

type SortableField = 'createdAt' | 'action' | 'objectName' | 'eventName' | 'category' | 'tableName' | 'schemaName';

export async function GET(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'data';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;
    const action = url.searchParams.get('action') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const sortBy = (url.searchParams.get('sortBy') || 'createdAt') as SortableField;
    const sortDir = url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

    let rows: any[] = [];
    let total = 0;

    const orderBy = { [sortBy]: sortDir };

    if (type === 'data') {
      const where: any = { tenantId };
      if (action) where.action = action.toUpperCase();
      if (search) where.objectName = { contains: search, mode: 'insensitive' };

      const [countResult, dataResult] = await Promise.all([
        db.dataAuditLog.count({ where }),
        db.dataAuditLog.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          select: {
            id: true, action: true, objectName: true, recordId: true,
            oldValues: true, newValues: true, createdAt: true, ipAddress: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);
      total = countResult;
      rows = dataResult;
    } else if (type === 'system') {
      const where: any = { tenantId };
      if (action) where.action = action.toUpperCase();
      if (search) where.eventName = { contains: search, mode: 'insensitive' };

      const [countResult, dataResult] = await Promise.all([
        db.systemEventLog.count({ where }),
        db.systemEventLog.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          select: {
            id: true, category: true, action: true, eventName: true,
            details: true, createdAt: true, ipAddress: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);
      total = countResult;
      rows = dataResult;
    } else if (type === 'ddl') {
      const where: any = {};
      if (tenantId) where.tenantId = tenantId;
      if (action) where.action = action.toUpperCase();
      if (search) where.tableName = { contains: search, mode: 'insensitive' };

      const [countResult, dataResult] = await Promise.all([
        db.ddlLog.count({ where }),
        db.ddlLog.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          select: {
            id: true, schemaName: true, tableName: true, action: true,
            sqlExecuted: true, createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);
      total = countResult;
      rows = dataResult;
    }

    return NextResponse.json({
      success: true,
      data: { rows, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('[API AUDIT LOGS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
