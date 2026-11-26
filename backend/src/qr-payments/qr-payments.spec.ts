import { createHmac, randomBytes } from 'crypto';
import { verifyBankWebhook, codeInDescription } from './providers/bank-webhook';
import { momo, momoIpnRaw, momoSign } from './providers/momo';
import {
  buildVietQr,
  crc16ccitt,
  parseTlv,
  vietqrText,
} from './providers/vietqr';
import { vnpay, vnpSignedQuery, vnpVerify } from './providers/vnpay';
import { zalopay } from './providers/zalopay';
import { decryptSecrets, encryptSecrets, maskSecret } from './secrets';

describe('VietQR payload', () => {
  it('CRC-16/CCITT-FALSE check value of "123456789" is 29B1', () => {
    expect(crc16ccitt('123456789')).toBe('29B1');
  });

  it('builds a dynamic NAPAS payload with amount, description and a valid CRC', () => {
    const qr = buildVietQr({
      bankBin: '970436',
      accountNumber: '0071000123456',
      amount: 1_250_000,
      description: 'QRAB12CD34 Thanh toán',
    });
    const top = parseTlv(qr);
    expect(top['00']).toBe('01');
    expect(top['01']).toBe('12');
    expect(top['53']).toBe('704');
    expect(top['54']).toBe('1250000');
    expect(top['58']).toBe('VN');
    const merchant = parseTlv(top['38']);
    expect(merchant['00']).toBe('A000000727');
    expect(merchant['02']).toBe('QRIBFTTA');
    expect(parseTlv(merchant['01'])).toEqual({
      '00': '970436',
      '01': '0071000123456',
    });
    expect(parseTlv(top['62'])['08']).toBe('QRAB12CD34 Thanh toan');
    expect(crc16ccitt(qr.slice(0, -4))).toBe(qr.slice(-4));
  });

  it('descriptions are ASCII and at most 25 characters', () => {
    expect(vietqrText('Đơn hàng số 12 — giảm giá đặc biệt')).toBe(
      'Don hang so 12 giam gia d',
    );
  });
});

describe('provider signatures', () => {
  const settingsMomo = {
    config: { partner_code: 'MOMOX' },
    secrets: { access_key: 'AK', secret_key: 'SK' },
  };
  const ipn = {
    partnerCode: 'MOMOX',
    orderId: 'QRAB12CD34',
    requestId: 'QRAB12CD34',
    amount: 450000,
    orderInfo: 'Thanh toan',
    orderType: 'momo_wallet',
    transId: 4088878653,
    resultCode: 0,
    message: 'Thành công.',
    payType: 'qr',
    responseTime: 1700000000000,
    extraData: '',
  };

  it('MoMo IPN: valid signature pays, a changed amount fails verification', () => {
    const body = { ...ipn, signature: momoSign(momoIpnRaw(ipn, 'AK'), 'SK') };
    expect(
      momo.verify({ body, query: {}, headers: {} }, settingsMomo),
    ).toMatchObject({
      signatureOk: true,
      paid: true,
      code: 'QRAB12CD34',
      providerRef: '4088878653',
      amount: 450000,
    });
    expect(
      momo.verify(
        { body: { ...body, amount: 1 }, query: {}, headers: {} },
        settingsMomo,
      ),
    ).toMatchObject({ signatureOk: false, paid: false });
  });

  it('ZaloPay callback: mac = HMAC-SHA256(key2, data)', () => {
    const data = JSON.stringify({
      app_trans_id: '270110_QRAB12CD34',
      zp_trans_id: 2701100001,
      amount: 300000,
    });
    const body = {
      data,
      mac: createHmac('sha256', 'K2').update(data).digest('hex'),
      type: 1,
    };
    const s = {
      config: { app_id: '2553' },
      secrets: { key1: 'K1', key2: 'K2' },
    };
    expect(zalopay.codeOf({ body, query: {}, headers: {} })).toBe('QRAB12CD34');
    expect(zalopay.verify({ body, query: {}, headers: {} }, s)).toMatchObject({
      signatureOk: true,
      paid: true,
      amount: 300000,
      providerRef: '2701100001',
    });
    expect(
      zalopay.verify({ body: { ...body, mac: 'x' }, query: {}, headers: {} }, s)
        .signatureOk,
    ).toBe(false);
    expect(zalopay.reply(null, 'invalid').body).toEqual({
      return_code: -1,
      return_message: 'mac not equal',
    });
  });

  it('VNPay: signed query verifies; any change breaks it; IPN amount is /100', () => {
    const params = {
      vnp_TxnRef: 'QRAB12CD34',
      vnp_Amount: '45000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14000000',
      vnp_OrderInfo: 'Thanh toan don',
    };
    const q = Object.fromEntries(
      new URLSearchParams(vnpSignedQuery(params, 'HS')).entries(),
    );
    expect(vnpVerify(q, 'HS')).toBe(true);
    expect(vnpVerify({ ...q, vnp_Amount: '1' }, 'HS')).toBe(false);
    const r = vnpay.verify(
      { body: {}, query: q, headers: {} },
      { config: {}, secrets: { hash_secret: 'HS' } },
    );
    expect(r).toMatchObject({
      signatureOk: true,
      paid: true,
      amount: 450000,
      providerRef: '14000000',
    });
    expect(vnpay.reply(r, 'ok').body).toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
  });

  it('bank webhook: HMAC of the raw body; code found in the description', () => {
    const raw = JSON.stringify({
      id: 'TX1',
      amount: 1250000,
      description: 'CT DEN 123 qrab12cd34 thanh toan',
    });
    const sig = createHmac('sha256', 'WS').update(raw).digest('hex');
    const ok = verifyBankWebhook(
      {
        body: JSON.parse(raw) as Record<string, unknown>,
        query: {},
        headers: { 'x-signature': sig },
        rawBody: raw,
      },
      'WS',
    );
    expect(ok).toMatchObject({
      signatureOk: true,
      code: 'QRAB12CD34',
      amount: 1250000,
    });
    expect(
      verifyBankWebhook(
        {
          body: {},
          query: {},
          headers: { 'x-signature': sig },
          rawBody: raw + ' ',
        },
        'WS',
      ).signatureOk,
    ).toBe(false);
    expect(codeInDescription('QR AB12 CD34')).toBe('QRAB12CD34');
  });
});

describe('secrets', () => {
  const prev = process.env.QR_SECRETS_KEY;
  afterAll(() => {
    process.env.QR_SECRETS_KEY = prev;
  });

  it('round trip with AES-256-GCM, masked display, refuses without a key', () => {
    process.env.QR_SECRETS_KEY = randomBytes(32).toString('base64');
    const enc = encryptSecrets({ secret_key: 'abcdef123456' });
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc).not.toContain('abcdef');
    expect(decryptSecrets(enc)).toEqual({ secret_key: 'abcdef123456' });
    expect(maskSecret('abcdef123456')).toBe('••••3456');
    delete process.env.QR_SECRETS_KEY;
    expect(() => encryptSecrets({ a: 'b' })).toThrow();
  });
});
