import { createHmac } from 'crypto';
import { CallbackInput, CallbackResult, QrProvider, str } from './provider';

const hmac = (key: string, data: string) =>
  createHmac('sha256', key).update(data).digest('hex');
const base = (sandbox: unknown) =>
  sandbox === false
    ? 'https://payment.momo.vn'
    : 'https://test-payment.momo.vn';

/** Raw string of the MoMo v2 IPN signature (documented field order). */
export const momoIpnRaw = (b: Record<string, unknown>, accessKey: string) =>
  `accessKey=${accessKey}&amount=${str(b.amount)}&extraData=${str(b.extraData)}&message=${str(b.message)}&orderId=${str(b.orderId)}&orderInfo=${str(b.orderInfo)}&orderType=${str(b.orderType)}&partnerCode=${str(b.partnerCode)}&payType=${str(b.payType)}&requestId=${str(b.requestId)}&responseTime=${str(b.responseTime)}&resultCode=${str(b.resultCode)}&transId=${str(b.transId)}`;

export const momoSign = (raw: string, secretKey: string) =>
  hmac(secretKey, raw);

/** MoMo v2 captureWallet (design D2). */
export const momo: QrProvider = {
  async create(req, s, urls, http) {
    const partnerCode = str(s.config.partner_code);
    const accessKey = s.secrets.access_key ?? '';
    const requestId = req.code;
    const body = {
      partnerCode,
      requestId,
      amount: Math.round(req.amount),
      orderId: req.code,
      orderInfo: req.description,
      redirectUrl: urls.returnUrl,
      ipnUrl: urls.callbackUrl,
      requestType: 'captureWallet',
      extraData: '',
      lang: 'vi',
    };
    const raw = `accessKey=${accessKey}&amount=${body.amount}&extraData=&ipnUrl=${body.ipnUrl}&orderId=${body.orderId}&orderInfo=${body.orderInfo}&partnerCode=${partnerCode}&redirectUrl=${body.redirectUrl}&requestId=${requestId}&requestType=captureWallet`;
    const res = (await http(`${base(s.config.sandbox)}/v2/gateway/api/create`, {
      ...body,
      signature: hmac(s.secrets.secret_key ?? '', raw),
    })) as Record<string, unknown>;
    if (Number(res.resultCode) !== 0)
      throw new Error(`MoMo: ${str(res.message) || 'tạo giao dịch thất bại'}`);
    return {
      qr_content: str(res.qrCodeUrl || res.payUrl),
      pay_url: str(res.payUrl) || null,
      raw: res,
    };
  },
  codeOf: (i: CallbackInput) => (i.body.orderId ? str(i.body.orderId) : null),
  verify(i, s): CallbackResult {
    const b = i.body;
    const ok =
      !!s.secrets.secret_key &&
      momoSign(
        momoIpnRaw(b, s.secrets.access_key ?? ''),
        s.secrets.secret_key,
      ) === str(b.signature);
    const rc = Number(b.resultCode);
    return {
      code: str(b.orderId) || null,
      signatureOk: ok,
      paid: ok && rc === 0,
      failed: ok && rc !== 0 && rc !== 9000 && rc !== 7000,
      amount: Number(b.amount),
      providerRef: str(b.transId),
    };
  },
  async query(req, s, http) {
    const partnerCode = str(s.config.partner_code);
    const raw = `accessKey=${s.secrets.access_key ?? ''}&orderId=${req.code}&partnerCode=${partnerCode}&requestId=${req.code}`;
    const res = (await http(`${base(s.config.sandbox)}/v2/gateway/api/query`, {
      partnerCode,
      requestId: req.code,
      orderId: req.code,
      lang: 'vi',
      signature: hmac(s.secrets.secret_key ?? '', raw),
    })) as Record<string, unknown>;
    const rc = Number(res.resultCode);
    return {
      paid: rc === 0,
      failed: rc !== 0 && rc !== 1000 && rc !== 7000 && rc !== 9000,
      amount: Number(res.amount),
      providerRef: str(res.transId),
      raw: res,
    };
  },
  reply: () => ({ status: 204 }),
};
