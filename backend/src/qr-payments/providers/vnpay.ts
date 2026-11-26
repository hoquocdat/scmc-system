import { createHmac } from 'crypto';
import { CallbackInput, CallbackResult, QrProvider, str } from './provider';

const VN_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
/** yyyyMMddHHmmss in Vietnam time. */
export const vnpDate = (d: Date) => {
  const p = Object.fromEntries(
    VN_TIME.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
};
const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');

/** VNPay 2.1.0 signed query: keys sorted, values URL-encoded (space = +), HMAC-SHA512. */
export function vnpSignedQuery(
  params: Record<string, string>,
  secret: string,
): string {
  const q = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join('&');
  return `${q}&vnp_SecureHash=${createHmac('sha512', secret).update(q).digest('hex')}`;
}

export function vnpVerify(
  query: Record<string, string>,
  secret: string,
): boolean {
  const { vnp_SecureHash: hash, vnp_SecureHashType: _t, ...rest } = query;
  void _t;
  if (!hash) return false;
  const signed = vnpSignedQuery(rest, secret);
  return (
    signed.slice(signed.lastIndexOf('=') + 1).toLowerCase() ===
    hash.toLowerCase()
  );
}

/** VNPay QR through the VNPAYQR payment page (design D2). */
export const vnpay: QrProvider = {
  create(req, s, urls) {
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: str(s.config.tmn_code),
      vnp_Amount: String(Math.round(req.amount) * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: req.code,
      vnp_OrderInfo: req.description,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: urls.returnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: vnpDate(req.createdAt),
      vnp_ExpireDate: vnpDate(req.expiresAt),
      vnp_BankCode: 'VNPAYQR',
    };
    const host =
      s.config.sandbox === false
        ? 'https://pay.vnpay.vn'
        : 'https://sandbox.vnpayment.vn';
    const url = `${host}/paymentv2/vpcpay.html?${vnpSignedQuery(params, s.secrets.hash_secret ?? '')}`;
    return Promise.resolve({ qr_content: url, pay_url: url });
  },
  codeOf: (i: CallbackInput) => i.query.vnp_TxnRef || null,
  verify(i, s): CallbackResult {
    const q = i.query;
    const ok = !!s.secrets.hash_secret && vnpVerify(q, s.secrets.hash_secret);
    const success =
      q.vnp_ResponseCode === '00' && q.vnp_TransactionStatus === '00';
    return {
      code: q.vnp_TxnRef || null,
      signatureOk: ok,
      paid: ok && success,
      failed: ok && !success,
      amount: Number(q.vnp_Amount) / 100,
      providerRef: q.vnp_TransactionNo,
    };
  },
  reply: (_r, outcome) => ({
    status: 200,
    body:
      outcome === 'invalid'
        ? { RspCode: '97', Message: 'Invalid signature' }
        : outcome === 'unknown'
          ? { RspCode: '01', Message: 'Order not found' }
          : outcome === 'amount'
            ? { RspCode: '04', Message: 'Invalid amount' }
            : outcome === 'duplicate'
              ? { RspCode: '02', Message: 'Order already confirmed' }
              : { RspCode: '00', Message: 'Confirm Success' },
  }),
};
