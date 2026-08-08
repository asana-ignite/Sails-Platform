/**
 * Notification helpers — recipient resolution, template rendering, and
 * bell-notification insert.  Email delivery is handled by MailService;
 * this module owns the shared logic between the notification event plugin
 * and any future notification producer (chat, approvals, system alerts).
 */
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { genId, quoteIdent, evaluateJsonata } from './WorkflowHelpers';

// ─── Recipient resolution ────────────────────────────────────

export interface ResolvedRecipient {
  userId?: string;
  email?: string;
}

export type RecipientInput = string | Array<string | { __expr: string }>;

/** Tokenise the raw recipient string (comma / semicolon separated). */
function tokenise(raw: string): string[] {
  return raw.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
}

/** Push email addresses from an evaluated __expr result. */
function pushExprResult(results: ResolvedRecipient[], value: any): void {
  if (value == null) return;
  if (typeof value === 'string') {
    for (const part of value.split(/[,;]+/).map((s) => s.trim())) {
      if (part) results.push({ email: part });
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') results.push({ email: item });
      else if (item && typeof item === 'object' && item.email) results.push({ email: item.email });
    }
  } else if (typeof value === 'object' && value.email) {
    results.push({ email: value.email });
  }
}

/**
 * Resolve a recipient expression into concrete user ids + email addresses.
 * Supports:
 *   user:<id>  team:<id>  position:<id>  role:<role>  email@domain  {{var}}
 *   { __expr: "<jsonata>" } — evaluated against variables + record; the
 *   result (email string / comma-list / array of emails) becomes recipients.
 */
export async function resolveRecipients(
  tenantId: string,
  raw: RecipientInput,
  variables: Record<string, any> = {},
  record?: { values?: Record<string, any> } | null,
): Promise<ResolvedRecipient[]> {
  const tokens = Array.isArray(raw) ? raw : tokenise(raw ?? '');
  const results: ResolvedRecipient[] = [];

  for (const token of tokens) {
    // Expression token — evaluate JSONata against variables + record.
    if (token && typeof token === 'object' && token.__expr) {
      try {
        const evalResult = await evaluateJsonata(token.__expr, { ...variables, record: record?.values || {} });
        if (evalResult.ok) {
          pushExprResult(results, evalResult.value);
        }
      } catch {
        // evaluation errors are logged upstream — skip token
      }
      continue;
    }
    if (typeof token !== 'string') continue;

    if (token.startsWith('user:')) {
      const u = await db.user.findFirst({
        where: { id: token.slice(5), tenantId, isActive: true },
        select: { id: true, email: true },
      });
      if (u) results.push({ userId: u.id, email: u.email });
    } else if (token.startsWith('team:')) {
      const members = await db.userTeam.findMany({
        where: { teamId: token.slice(5) },
        select: { user: { select: { id: true, email: true } } },
      });
      for (const m of members) {
        if (m.user) results.push({ userId: m.user.id, email: m.user.email });
      }
    } else if (token.startsWith('position:')) {
      const slots = await db.positionSlot.findMany({
        where: { positionId: token.slice(9), userId: { not: null } },
        select: { user: { select: { id: true, email: true } } },
      });
      for (const s of slots) {
        if (s.user) results.push({ userId: s.user.id, email: s.user.email });
      }
    } else if (token.startsWith('role:')) {
      const users = await db.user.findMany({
        where: { tenantId, role: token.slice(5), isActive: true },
        select: { id: true, email: true },
      });
      for (const u of users) results.push({ userId: u.id, email: u.email });
    } else if (token.startsWith('{{') && token.endsWith('}}')) {
      // Variable reference — resolved at runtime.
      const varName = token.slice(2, -2).trim();
      const val = variables[varName];
      if (!val) continue;
      if (typeof val === 'string') {
        results.push({ email: val });
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string') results.push({ email: item });
          else if (item && typeof item === 'object' && item.email) results.push({ email: item.email });
          else if (item && typeof item === 'object' && item.id) {
            // record row — try email field first
            if (item.email) results.push({ email: item.email });
          }
        }
      }
    } else if (token.includes('@')) {
      // Plain email address
      results.push({ email: token });
    }
    // Unknown tokens are silently ignored.
  }

  // Deduplicate by userId (or email when no userId).
  const seen = new Set<string>();
  const deduped: ResolvedRecipient[] = [];
  for (const r of results) {
    const key = r.userId || r.email || '';
    if (key && !seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  return deduped;
}

// ─── Template rendering ──────────────────────────────────────

/**
 * Replace {{variableName}} markers in the template string with values from
 * the context (variables + optional record fields).
 */
export async function renderTemplate(
  tpl: string,
  variables: Record<string, any>,
  record?: { values?: Record<string, any>; oldValues?: Record<string, any> } | null,
  wf?: { requestor?: Record<string, any> | null; requestDate?: string | null } | null,
): Promise<string> {
  if (!tpl) return '';
  let out = tpl;
  // Pass 1 — JSONata expressions: {{$expr}}
  for (const m of [...tpl.matchAll(/\{\{(\$[\s\S]*?)\}\}/g)]) {
    let text = '';
    try {
      const res = await evaluateJsonata(m[1].trim(), { ...variables, record: record?.values || {} });
      const v = res.ok ? res.value : undefined;
      text = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    } catch { /* expression failed — drop marker */ }
    out = out.replace(m[0], text);
  }
  // Pass 2 — {{var}} / {{record.field}} / {{oldRecord.*}} / {{requestor.*}} / {{request_date}}
  return out.replace(/\{\{([\w.]+)\}\}/g, (_match, key) => {
    const parts = String(key).split('.');
    if (parts[0] === 'record' && record?.values) {
      const val = record.values[parts[1]];
      return val == null ? '' : String(val);
    }
    if (parts[0] === 'oldRecord' && record?.oldValues) {
      const val = record.oldValues[parts[1]];
      return val == null ? '' : String(val);
    }
    if (parts[0] === 'requestor' && wf?.requestor) {
      const val = wf.requestor[parts[1]];
      return val == null ? '' : String(val);
    }
    if (key === 'request_date') return wf?.requestDate ?? '';
    const val = variables[parts[0]];
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

// ─── Bell delivery ───────────────────────────────────────────

export async function insertBellNotification(
  tenantSchema: string,
  instanceId: string,
  recipients: ResolvedRecipient[],
  subject: string,
  body: string,
  source: string = 'workflow',
): Promise<number> {
  if (recipients.length === 0) return 0;
  const s = quoteIdent(tenantSchema);
  let count = 0;
  for (const r of recipients) {
    if (!r.userId) continue; // bell only for known tenant users
    try {
      await pool.query(
        `INSERT INTO ${s}.wf_notification (id, instance_id, user_id, source, subject, body, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'delivered')`,
        [genId('wfn'), instanceId, r.userId, source, subject || null, body || null],
      );
      count++;
    } catch {
      // best-effort — skip duplicates / FK violations silently
    }
  }
  return count;
}

// ─── Attachment resolution ───────────────────────────────────

export interface AttachmentSpec {
  source: 'record_field' | 'variable' | 'url';
  fieldName?: string;
  variableName?: string;
  fieldKey?: string;
  url?: string;
  filename?: string;
  cid?: string; // inline content-id for <img src="cid:...">
}

export interface ResolvedAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  cid?: string;
}

function basename(filepath: string): string {
  const parts = String(filepath).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filepath;
}

function parseSingleAttachmentValue(val: any, specFilename?: string, specCid?: string): ResolvedAttachment | null {
  if (!val) return null;

  // String: treat as file path or URL
  if (typeof val === 'string') {
    return { filename: specFilename || basename(val), path: val, cid: specCid };
  }

  // Single attachment object { name, url, path, content }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const filename = specFilename || val.filename || val.name || basename(val.url || val.path || '');
    return {
      filename,
      path: val.url || val.path || undefined,
      content: val.content ? Buffer.from(val.content, val.contentEncoding || 'base64') : undefined,
      cid: specCid || val.cid,
    };
  }

  // Array: first file only
  if (Array.isArray(val) && val.length > 0) {
    return parseSingleAttachmentValue(val[0], specFilename, specCid);
  }

  return null;
}

/**
 * Resolve attachment specs from the notification config into nodemailer-
 * compatible attachment objects.  Reads from the triggering record's fields
 * and/or workflow variables.
 */
export function resolveAttachments(
  specs: AttachmentSpec[] | undefined,
  record: { values?: Record<string, any> } | null,
  variables: Record<string, any>,
): ResolvedAttachment[] {
  if (!specs || specs.length === 0) return [];
  const results: ResolvedAttachment[] = [];

  for (const spec of specs) {
    let value: any = null;
    if (spec.source === 'record_field' && record?.values && spec.fieldName) {
      value = record.values[spec.fieldName];
    } else if (spec.source === 'variable' && spec.variableName) {
      const varVal = variables[spec.variableName];
      if (varVal && spec.fieldKey) {
        // collection row — extract the key
        if (Array.isArray(varVal) && varVal.length > 0) {
          value = varVal[0][spec.fieldKey];
        }
      } else {
        value = varVal;
      }
    } else if (spec.source === 'url' && spec.url) {
      value = spec.url;
    }

    const resolved = parseSingleAttachmentValue(value, spec.filename, spec.cid);
    if (resolved) results.push(resolved);
  }

  return results;
}
