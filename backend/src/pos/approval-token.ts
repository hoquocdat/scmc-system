import { createHmac, timingSafeEqual } from 'crypto';

/** Discount approvals are valid for this long (design D9). */
export const APPROVAL_TTL_SECONDS = 5 * 60;

export interface ApprovalPayload {
  /** client_request_id the approval is bound to */
  rid: string;
  /** approved discount percent */
  pct: number;
  /** approver user id */
  by: string;
  /** expiry, unix seconds */
  exp: number;
}

const b64url = (buf: Buffer): string => buf.toString('base64url');

/** Compact HMAC-SHA256 signed token: base64url(payload).base64url(signature). */
export function signApproval(payload: ApprovalPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyApproval(
  token: string,
  secret: string,
  now: Date = new Date(),
): ApprovalPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as ApprovalPayload;
    if (
      typeof payload.rid !== 'string' ||
      typeof payload.pct !== 'number' ||
      typeof payload.by !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (payload.exp * 1000 < now.getTime()) return null;
    return payload;
  } catch {
    return null;
  }
}
