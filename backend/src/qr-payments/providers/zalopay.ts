import { createHmac } from 'crypto';
import { CallbackInput, CallbackResult, QrProvider, str } from './provider';

const hmac = (key: string, data: string) =>
  createHmac('sha256', key).update(data).digest('hex');
const base = (sandbox: unknown) =>
  sandbox === false
    ? 'https://openapi.zalopay.vn'
    : 'https://sb-openapi.zalopay.vn';
const VN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
});
export const zaloTransId = (code: string, at: Date) =>
  `${VN_DAY.format(at).replace(/\D/g, '')}_${code}`;
const codeFromTrans = (t: string) =>
  t.includes('_') ? t.split('_').slice(1).join('_') : t;

/** ZaloPay v2 (design D2): create mac over app_id|app_trans_id|app_user|amount|app_time|embed_data|item. */
export const zalopay: QrProvider = {
  async create(req, s, urls, http) {
    const appId = str(s.config.app_id);
    const order = {
      app_id: Number(appId),
      app_user: 'scmc',
      app_trans_id: zaloTransId(req.code, req.createdAt),
      app_time: req.createdAt.getTime(),
      amount: Math.round(req.amount),
      item: '[]',
      embed_data: JSON.stringify({ redirecturl: urls.returnUrl }),
      description: req.description,
      bank_code: '',
      callback_url: urls.callbackUrl,
      expire_duration_seconds: Math.max(
        300,
        Math.round((req.expiresAt.getTime() - req.createdAt.getTime()) / 1000),
      ),
    };
    const mac = hmac(
      s.secrets.key1 ?? '',
      `${appId}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`,
    );
    const res = (await http(
      `${base(s.config.sandbox)}/v2/create`,
      { ...order, mac },
      true,
    )) as Record<string, unknown>;
    if (Number(res.return_code) !== 1)
      throw new Error(
        `ZaloPay: ${str(res.return_message) || 'tạo đơn thất bại'}`,
      );
    return {
      qr_content: str(res.qr_code || res.order_url),
      pay_url: str(res.order_url) || null,
      raw: res,
    };
  },
  codeOf(i: CallbackInput) {
    try {
      const data = JSON.parse(str(i.body.data)) as Record<string, unknown>;
      return codeFromTrans(str(data.app_trans_id)) || null;
    } catch {
      return null;
    }
  },
  verify(i, s): CallbackResult {
    const ok =
      !!s.secrets.key2 &&
      hmac(s.secrets.key2, str(i.body.data)) === str(i.body.mac);
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(str(i.body.data)) as Record<string, unknown>;
    } catch {
      return { code: null, signatureOk: false, paid: false, failed: false };
    }
    // ZaloPay only calls back on success
    return {
      code: codeFromTrans(str(data.app_trans_id)) || null,
      signatureOk: ok,
      paid: ok,
      failed: false,
      amount: Number(data.amount),
      providerRef: str(data.zp_trans_id),
    };
  },
  async query(req, s, http) {
    const appId = str(s.config.app_id);
    const transId = zaloTransId(req.code, req.createdAt);
    const res = (await http(
      `${base(s.config.sandbox)}/v2/query`,
      {
        app_id: appId,
        app_trans_id: transId,
        mac: hmac(
          s.secrets.key1 ?? '',
          `${appId}|${transId}|${s.secrets.key1 ?? ''}`,
        ),
      },
      true,
    )) as Record<string, unknown>;
    const rc = Number(res.return_code);
    return {
      paid: rc === 1,
      failed: rc === 2,
      amount: Number(res.amount),
      providerRef: str(res.zp_trans_id),
      raw: res,
    };
  },
  reply: (_r, outcome) => ({
    status: 200,
    body:
      outcome === 'invalid'
        ? { return_code: -1, return_message: 'mac not equal' }
        : { return_code: 1, return_message: 'success' },
  }),
};
