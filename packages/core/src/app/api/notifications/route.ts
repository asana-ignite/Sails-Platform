/**
 * Notification Bell API — user-facing.
 *
 * GET  /api/notifications                  → paginated list
 * GET  /api/notifications?count=true       → unread count (badge)
 * PATCH /api/notifications?id=X&mark=read  → mark one read
 * PATCH /api/notifications?mark_all_read=true → mark all read
 *
 * All data lives in tenant schemas — never stored in core.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';

function quoteIdent(name: string): string {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

export async function GET(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const countOnly = searchParams.get('count') === 'true';
    const id = searchParams.get('id');

    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { schemaName: true } });
    if (!tenant?.schemaName) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 500 });
    }
    const s = quoteIdent(tenant.schemaName);

    if (id) {
      const res = await pool.query(
        `SELECT id, instance_id, source, subject, body, status, created_at, read_at
         FROM ${s}.wf_notification WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      if (res.rows.length === 0) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: res.rows[0] });
    }

    if (countOnly) {
      const res = await pool.query(
        `SELECT COUNT(*)::int AS n FROM ${s}.wf_notification WHERE user_id = $1 AND status = 'delivered'`,
        [userId],
      );
      return NextResponse.json({ success: true, data: { unread: res.rows[0]?.n || 0 } });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15')));
    const source = searchParams.get('source'); // optional filter
    const where = `user_id = $1${source ? ` AND source = '${(source as string).replace(/'/g, "''")}'` : ''}`;

    const [rowsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, instance_id, source, subject, body, status, created_at, read_at
         FROM ${s}.wf_notification
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, (page - 1) * limit],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM ${s}.wf_notification WHERE ${where}`,
        [userId],
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rows: rowsRes.rows,
        total: countRes.rows[0]?.n || 0,
        page,
        limit,
        totalPages: Math.ceil((countRes.rows[0]?.n || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('[API NOTIFICATIONS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const markAll = searchParams.get('mark_all_read') === 'true';

    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { schemaName: true } });
    if (!tenant?.schemaName) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 500 });
    }
    const s = quoteIdent(tenant.schemaName);

    if (markAll) {
      await pool.query(
        `UPDATE ${s}.wf_notification SET status = 'read', read_at = now() WHERE user_id = $1 AND status = 'delivered'`,
        [userId],
      );
      return NextResponse.json({ success: true, message: 'All marked read' });
    }

    if (id) {
      await pool.query(
        `UPDATE ${s}.wf_notification SET status = 'read', read_at = now() WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return NextResponse.json({ success: true, message: 'Marked read' });
    }

    return NextResponse.json({ success: false, error: 'id or mark_all_read parameter required' }, { status: 400 });
  } catch (error: any) {
    console.error('[API NOTIFICATIONS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
