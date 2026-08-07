/**
 * AES-256-GCM encryption for SMTP passwords and OAuth secrets stored in
 * core.email_connections.  Keyed by ENCRYPTION_KEY (64 hex chars).
 *
 * Never log, expose, or return the encryption key.
 */
import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) return null;
  return Buffer.from(raw, 'hex');
}

export function encrypt(plaintext: string): string | null {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv : authTag : ciphertext  (hex-encodes each part)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string | null {
  const key = getKey();
  if (!key) return null;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null; // wrong key or corrupted data
  }
}
