/**
 * Email Connection admin API — SMTP / OAuth email settings per tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';
import { encrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const conn = await db.emailConnection.findFirst({ where: { id, tenantId } });
      if (!conn) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: sanitise(conn) });
    }

    const rows = await db.emailConnection.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: rows.map(sanitise) });
  } catch (error: any) {
    console.error('[API EMAIL-CONNECTIONS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const body = await req.json();
    const { name, provider, smtpHost, smtpPort, smtpSecure, username, password, fromName, fromEmail, replyTo } = body;

    if (!name || !fromName || !fromEmail) {
      return NextResponse.json({ success: false, error: 'name, fromName and fromEmail are required' }, { status: 400 });
    }

    const data: any = {
      tenantId,
      name: name.trim(),
      provider: provider || 'smtp',
      fromName: fromName.trim(),
      fromEmail: fromEmail.trim(),
      replyTo: replyTo || null,
    };
    if (smtpHost) data.smtpHost = smtpHost;
    if (smtpPort) data.smtpPort = Number(smtpPort);
    if (smtpSecure !== undefined) data.smtpSecure = !!smtpSecure;
    if (username) data.username = username;
    if (password) {
      const enc = encrypt(password);
      if (!enc) return NextResponse.json({ success: false, error: 'ENCRYPTION_KEY not configured' }, { status: 500 });
      data.password = enc;
      data.authType = 'basic';
    }

    const conn = await db.emailConnection.create({ data });

    SchemaLogger.logSystemEvent({
      tenantId, userId,
      category: 'SETTINGS',
      action: 'CREATE',
      eventName: 'Create Email Connection',
      details: { id: conn.id, name: conn.name },
    });

    return NextResponse.json({ success: true, data: sanitise(conn) }, { status: 201 });
  } catch (error: any) {
    console.error('[API EMAIL-CONNECTIONS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const existing = await db.emailConnection.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const data: any = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.isDefault !== undefined) {
      data.isDefault = !!body.isDefault;
      if (data.isDefault) {
        await db.emailConnection.updateMany({
          where: { tenantId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
    }
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.provider !== undefined) data.provider = body.provider;
    if (body.smtpHost !== undefined) data.smtpHost = body.smtpHost;
    if (body.smtpPort !== undefined) data.smtpPort = Number(body.smtpPort);
    if (body.smtpSecure !== undefined) data.smtpSecure = !!body.smtpSecure;
    if (body.username !== undefined) data.username = body.username;
    if (body.password !== undefined && body.password) {
      const enc = encrypt(body.password);
      if (!enc) return NextResponse.json({ success: false, error: 'ENCRYPTION_KEY not configured' }, { status: 500 });
      data.password = enc;
      data.authType = 'basic';
    }
    if (body.fromName !== undefined) data.fromName = body.fromName;
    if (body.fromEmail !== undefined) data.fromEmail = body.fromEmail;
    if (body.replyTo !== undefined) data.replyTo = body.replyTo;

    const updated = await db.emailConnection.update({ where: { id }, data });

    SchemaLogger.logSystemEvent({
      tenantId, userId,
      category: 'SETTINGS',
      action: 'UPDATE',
      eventName: 'Update Email Connection',
      details: { id: updated.id, name: updated.name },
    });

    return NextResponse.json({ success: true, data: sanitise(updated) });
  } catch (error: any) {
    console.error('[API EMAIL-CONNECTIONS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const existing = await db.emailConnection.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    await db.emailConnection.delete({ where: { id } });

    SchemaLogger.logSystemEvent({
      tenantId, userId,
      category: 'SETTINGS',
      action: 'DELETE',
      eventName: 'Delete Email Connection',
      details: { id, name: existing.name },
    });

    return NextResponse.json({ success: true, message: 'Deleted' });
  } catch (error: any) {
    console.error('[API EMAIL-CONNECTIONS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** Strip encrypted fields from API responses. */
function sanitise(row: any): any {
  const { password, oauthClientSecret, oauthRefreshToken, oauthAccessToken, ...rest } = row;
  const result = { ...rest };
  result.hasPassword = !!password;
  result.hasOAuth = !!(row.oauthRefreshToken);
  return result;
}
