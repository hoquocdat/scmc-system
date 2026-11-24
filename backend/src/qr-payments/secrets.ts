import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { UnprocessableEntityException } from '@nestjs/common';

/** 32-byte key from QR_SECRETS_KEY (base64), or null when not configured. */
function key(): Buffer | null {
  const raw = process.env.QR_SECRETS_KEY;
  if (!raw) return null;
  const k = Buffer.from(raw, 'base64');
  return k.length === 32 ? k : null;
}

/** AES-256-GCM: "v1:" + base64(iv | tag | ciphertext). */
export function encryptSecrets(values: Record<string, string>): string {
  const k = key();
  if (!k)
    throw new UnprocessableEntityException({
      code: 'QR_SECRETS_KEY_MISSING',
      message: 'Chưa cấu hình QR_SECRETS_KEY (32 byte, base64) trên máy chủ',
    });
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(values), 'utf8'),
    cipher.final(),
  ]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64')}`;
}

export function decryptSecrets(
  stored: string | null | undefined,
): Record<string, string> {
  if (!stored) return {};
  const k = key();
  if (!k || !stored.startsWith('v1:')) return {};
  const buf = Buffer.from(stored.slice(3), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', k, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const out = Buffer.concat([
    decipher.update(buf.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(out) as Record<string, string>;
}

/** "••••1234" for display; secrets are never returned in full. */
export const maskSecret = (v: string | undefined) =>
  v ? `••••${v.slice(-4)}` : '';
