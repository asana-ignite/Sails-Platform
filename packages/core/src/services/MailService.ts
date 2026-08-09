/**
 * MailService — sends email via tenant EmailConnection (v1: SMTP).
 *
 * Reads the tenant's default active EmailConnection row, decrypts the SMTP
 * password, and builds a nodemailer transport.  Delivery failures are returned
 * as errors; the caller decides whether to fail the event or log-and-continue.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export interface SendOptions {
  to: string[];
  subject: string;
  html: string;
  tenantId: string;
  /** Carbon-copy recipients (emails). */
  cc?: string[];
  /** Blind carbon-copy recipients (emails). */
  bcc?: string[];
  /** Specific connection id — when omitted the tenant default is used. */
  connectionId?: string;
  /** Nodemailer-compatible attachments. */
  attachments?: Attachment[];
}

export interface SendResult {
  ok: boolean;
  connectionId?: string;
  connectionName?: string;
  accepted?: string[];
  rejected?: string[];
  error?: string;
}

async function getConnection(tenantId: string, connectionId?: string) {
  if (connectionId) {
    return db.emailConnection.findFirst({ where: { id: connectionId, tenantId, isActive: true } });
  }
  return db.emailConnection.findFirst({ where: { tenantId, isActive: true, isDefault: true } });
}

export async function send(opts: SendOptions): Promise<SendResult> {
  const conn = await getConnection(opts.tenantId, opts.connectionId);
  if (!conn) return { ok: false, error: 'No active email connection found for this tenant' };
  if (!conn.smtpHost) return { ok: false, error: 'SMTP host is not configured' };

  const password = conn.password ? decrypt(conn.password) : null;

  let transporter: Transporter;
  try {
    transporter = nodemailer.createTransport({
      host: conn.smtpHost,
      port: conn.smtpPort || (conn.smtpSecure ? 465 : 587),
      secure: !!conn.smtpSecure,
      auth: conn.username && password
        ? { user: conn.username, pass: password }
        : undefined,
    });
  } catch (error: any) {
    return { ok: false, connectionId: conn.id, connectionName: conn.name, error: error?.message || 'Failed to create transport' };
  }

  try {
    const result = await transporter.sendMail({
      from: conn.fromEmail,
      sender: conn.fromName ? `"${conn.fromName}" <${conn.fromEmail}>` : conn.fromEmail,
      to: opts.to.join(', '),
      ...(opts.cc && opts.cc.length > 0 ? { cc: opts.cc.join(', ') } : {}),
      ...(opts.bcc && opts.bcc.length > 0 ? { bcc: opts.bcc.join(', ') } : {}),
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments || undefined,
      ...(conn.replyTo ? { replyTo: conn.replyTo } : {}),
    });
    return {
      ok: true,
      connectionId: conn.id,
      connectionName: conn.name,
      accepted: (result.accepted as string[]) || [],
      rejected: (result.rejected as string[]) || [],
    };
  } catch (error: any) {
    return { ok: false, connectionId: conn.id, connectionName: conn.name, error: error?.message || 'Unknown mail error' };
  }
}

export const MailService = { send };
export default MailService;
