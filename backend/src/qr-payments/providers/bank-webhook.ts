import { createHmac, timingSafeEqual } from 'crypto';
import { CallbackInput, CallbackResult, str } from './provider';

const CODE_RE = /QR[A-Z0-9]{8}/;

/** Request code inside a bank transfer description (banks may drop spaces or change case). */
export const codeInDescription = (d: string) =>
  d.toUpperCase().replace(/\s+/g, '').match(CODE_RE)?.[0] ?? null;

/**
 * Generic bank-notification webhook for VietQR auto-confirmation (design D2):
 * JSON { id, amount, description }, header X-Signature = HMAC-SHA256(secret, raw body).
 */
export function verifyBankWebhook(
  i: CallbackInput,
  secret: string | undefined,
): CallbackResult {
  const raw = i.rawBody ?? JSON.stringify(i.body);
  const given = str(i.headers['x-signature']);
  const expected = secret
    ? createHmac('sha256', secret).update(raw).digest('hex')
    : '';
  const ok =
    !!secret &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  return {
    code: codeInDescription(str(i.body.description)),
    signatureOk: ok,
    paid: ok,
    failed: false,
    amount: Number(i.body.amount),
    providerRef: str(i.body.id),
  };
}
