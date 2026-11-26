import 'reflect-metadata';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { CashBookPostingService } from '../../src/cash-book/cash-book-posting.service';
import {
  Action,
  CaslAbilityFactory,
} from '../../src/casl/casl-ability.factory';
import { LoyaltyService } from '../../src/loyalty/loyalty.service';
import { CheckoutPaymentMethod } from '../../src/pos/dto/checkout.dto';
import { PosCheckoutService } from '../../src/pos/pos-checkout.service';
import { PosService } from '../../src/pos/pos.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { momoIpnRaw, momoSign } from '../../src/qr-payments/providers/momo';
import { parseTlv } from '../../src/qr-payments/providers/vietqr';
import { QrPaymentsService } from '../../src/qr-payments/qr-payments.service';
import { PriceResolverService } from '../../src/sales/pricing/price-resolver';
import { SalesPostingService } from '../../src/sales/sales-posting.service';
import { closeTestDb, resetTestDb, testDb } from './db';
import { SalesFixtures, seedSalesFixtures } from './sales-fixtures';

/** Specs payments/qr-payments and the QR part of pos/checkout. */
describe('QR payments', () => {
  let fx: SalesFixtures;
  let qr: QrPaymentsService;
  let checkout: PosCheckoutService;
  let casl: CaslAbilityFactory;
  const calls: { url: string; body: unknown }[] = [];
  const cashier = () => ({ id: fx.users.store_manager });

  const sale = (
    requestId: string,
    amount: number,
    method: CheckoutPaymentMethod,
    clientRequestId: string = randomUUID(),
  ) =>
    checkout.checkout(cashier(), {
      client_request_id: clientRequestId,
      lines: [
        {
          product_id: fx.products.sticker,
          quantity: amount / 50_000,
          expected_unit_price: 50_000,
        },
      ],
      payments: [{ method, amount, qr_payment_request_id: requestId }],
    } as never);

  beforeAll(async () => {
    process.env.QR_SECRETS_KEY = randomBytes(32).toString('base64');
    await resetTestDb();
    fx = await seedSalesFixtures();
    const prisma = testDb as unknown as PrismaService;
    const cashBook = new CashBookPostingService(prisma);
    const posting = new SalesPostingService(
      prisma,
      new PriceResolverService(prisma),
      new LoyaltyService(prisma),
      cashBook,
    );
    casl = new CaslAbilityFactory(prisma);
    const activity = new ActivityLogsService(prisma);
    checkout = new PosCheckoutService(prisma, posting, casl, activity, {
      get: () => 'secret',
    } as unknown as ConfigService);
    qr = new QrPaymentsService(prisma);
    qr.http = (url, body) => {
      calls.push({ url, body });
      return Promise.resolve({
        resultCode: 0,
        qrCodeUrl: '2|99|0901234567|SCMC|x',
        payUrl: 'https://test-payment.momo.vn/pay/x',
      });
    };
    await new PosService(prisma, casl, activity, cashBook).openShift(
      cashier(),
      { store_id: fx.store.id, opening_cash: 0 },
    );
    await testDb.inventory.updateMany({
      where: { location_id: fx.store.locationId },
      data: { quantity_on_hand: 500 },
    });
    await qr.saveSettings(cashier(), fx.store.id, 'vietqr', {
      is_enabled: true,
      config: {
        bank_bin: '970436',
        account_number: '0071000123456',
        account_name: 'SCMC',
      },
      secrets: { webhook_secret: 'WS' },
      cash_account_id: fx.accounts.hcmBank,
    });
    await qr.saveSettings(cashier(), fx.store.id, 'momo', {
      is_enabled: true,
      config: { partner_code: 'MOMOX', sandbox: true },
      secrets: { access_key: 'AK', secret_key: 'SK' },
    });
  });
  afterAll(closeTestDb);

  it('settings hide secrets and show the callback URL', async () => {
    const s = await qr.listSettings(fx.store.id);
    expect(s.find((x) => x.provider === 'momo')?.secrets).toEqual({
      access_key: '••••AK',
      secret_key: '••••SK',
    });
    expect(s.find((x) => x.provider === 'vietqr')?.callback_url).toMatch(
      /\/api\/qr-payments\/callbacks\/bank\//,
    );
    const row = await testDb.qr_provider_settings.findFirstOrThrow({
      where: { provider: 'momo' },
    });
    expect(row.secrets).not.toContain('SK');
  });

  it('VietQR: exact amount and code; pending blocks checkout; manual confirm; checkout on the configured account', async () => {
    const r = await qr.create(cashier(), {
      store_id: fx.store.id,
      provider: 'vietqr',
      amount: 150_000,
      client_request_id: randomUUID(),
    });
    const top = parseTlv(r.qr_content);
    expect(top['54']).toBe('150000');
    expect(parseTlv(top['62'])['08']).toContain(r.code);
    await expect(
      sale(
        r.id,
        150_000,
        CheckoutPaymentMethod.BANK_TRANSFER,
        r.client_request_id,
      ),
    ).rejects.toMatchObject({ response: { code: 'QR_NOT_PAID' } });
    const confirmed = await qr.confirm(cashier(), r.id);
    expect(confirmed).toMatchObject({
      status: 'paid',
      confirmed_by: fx.users.store_manager,
    });
    const order = await sale(
      r.id,
      150_000,
      CheckoutPaymentMethod.BANK_TRANSFER,
      r.client_request_id,
    );
    const pay = order.sales_order_payments[0];
    expect(pay.transaction_id).toBe(r.code);
    const entry = await testDb.cash_book_entries.findFirstOrThrow({
      where: { source_id: pay.id },
    });
    expect(entry.account_id).toBe(fx.accounts.hcmBank);
    expect(
      (
        await testDb.qr_payment_requests.findUniqueOrThrow({
          where: { id: r.id },
        })
      ).sales_order_id,
    ).toBe(order.id);
    // another cart cannot use the request again (the same cart would replay the first sale)
    await expect(
      sale(r.id, 150_000, CheckoutPaymentMethod.BANK_TRANSFER),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('a request past its time expires and cannot pay', async () => {
    const r = await qr.create(cashier(), {
      store_id: fx.store.id,
      provider: 'vietqr',
      amount: 50_000,
    });
    await testDb.qr_payment_requests.update({
      where: { id: r.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    expect((await qr.get(r.id)).status).toBe('expired');
    await expect(qr.confirm(cashier(), r.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('MoMo: created through the API; valid IPN pays once; duplicate only logged; bad signature ignored', async () => {
    const r = await qr.create(cashier(), {
      store_id: fx.store.id,
      provider: 'momo',
      amount: 100_000,
    });
    expect(calls.at(-1)?.url).toBe(
      'https://test-payment.momo.vn/v2/gateway/api/create',
    );
    expect(r.qr_content).toBe('2|99|0901234567|SCMC|x');
    const ipn = {
      partnerCode: 'MOMOX',
      orderId: r.code,
      requestId: r.code,
      amount: 100000,
      orderInfo: 'x',
      orderType: 'momo_wallet',
      transId: 777,
      resultCode: 0,
      message: 'ok',
      payType: 'qr',
      responseTime: 1,
      extraData: '',
    };
    const body = { ...ipn, signature: momoSign(momoIpnRaw(ipn, 'AK'), 'SK') };
    const reply = await qr.callback('momo', { body, query: {}, headers: {} });
    expect(reply.status).toBe(204);
    await qr.callback('momo', { body, query: {}, headers: {} });
    const after = await testDb.qr_payment_requests.findUniqueOrThrow({
      where: { id: r.id },
    });
    expect([after.status, after.provider_ref]).toEqual(['paid', '777']);
    expect(
      await testDb.qr_payment_events.count({
        where: { request_id: r.id, kind: 'callback' },
      }),
    ).toBe(2);

    const other = await qr.create(cashier(), {
      store_id: fx.store.id,
      provider: 'momo',
      amount: 100_000,
    });
    await qr.callback('momo', {
      body: { ...body, orderId: other.code, requestId: other.code },
      query: {},
      headers: {},
    });
    expect(
      (
        await testDb.qr_payment_requests.findUniqueOrThrow({
          where: { id: other.id },
        })
      ).status,
    ).toBe('pending');
    expect(
      await testDb.qr_payment_events.findFirstOrThrow({
        where: { request_id: other.id, kind: 'callback' },
      }),
    ).toMatchObject({ signature_ok: false });

    const order = await sale(r.id, 100_000, CheckoutPaymentMethod.EWALLET_MOMO);
    expect(order.sales_order_payments[0]).toMatchObject({
      payment_method: 'ewallet_momo',
      transaction_id: '777',
    });
  });

  it('bank webhook pays a VietQR request by code and amount; a wrong amount fails it', async () => {
    const r = await qr.create(cashier(), {
      store_id: fx.store.id,
      provider: 'vietqr',
      amount: 200_000,
    });
    const raw = JSON.stringify({
      id: 'BANK-1',
      amount: 200000,
      description: `CT tu 0901 ${r.code.toLowerCase()} SCMC`,
    });
    const sig = createHmac('sha256', 'WS').update(raw).digest('hex');
    const res = await qr.bankWebhook(fx.store.id, {
      body: JSON.parse(raw) as Record<string, unknown>,
      query: {},
      headers: { 'x-signature': sig },
      rawBody: raw,
    });
    expect(res.body).toMatchObject({ matched: true, outcome: 'ok' });
    expect(
      (
        await testDb.qr_payment_requests.findUniqueOrThrow({
          where: { id: r.id },
        })
      ).status,
    ).toBe('paid');

    const r2 = await qr.create(cashier(), {
      store_id: fx.store.id,
      provider: 'vietqr',
      amount: 200_000,
    });
    const raw2 = JSON.stringify({
      id: 'BANK-2',
      amount: 20000,
      description: r2.code,
    });
    await qr.bankWebhook(fx.store.id, {
      body: JSON.parse(raw2) as Record<string, unknown>,
      query: {},
      headers: {
        'x-signature': createHmac('sha256', 'WS').update(raw2).digest('hex'),
      },
      rawBody: raw2,
    });
    expect(
      (
        await testDb.qr_payment_requests.findUniqueOrThrow({
          where: { id: r2.id },
        })
      ).status,
    ).toBe('failed');
    const bad = await qr.bankWebhook(fx.store.id, {
      body: {},
      query: {},
      headers: { 'x-signature': 'nope' },
      rawBody: '{}',
    });
    expect(bad.status).toBe(401);
  });

  it('grants: cashiers create and confirm; only managers configure', async () => {
    const can = async (role: string, a: Action) =>
      (await casl.createForUser(fx.users[role])).can(a, 'qr_payments');
    expect(await can('sales_associate', Action.Create)).toBe(true);
    expect(await can('sales_associate', Action.Confirm)).toBe(true);
    expect(await can('store_manager', Action.Configure)).toBe(false);
    expect(await can('manager', Action.Configure)).toBe(true);
  });
});
