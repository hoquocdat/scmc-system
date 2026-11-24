import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { verifyBankWebhook } from './providers/bank-webhook';
import { momo } from './providers/momo';
import {
  CallbackInput,
  CallbackResult,
  HttpPost,
  ProviderRequest,
  ProviderSettings,
  QrProvider,
  QrProviderName,
  str,
} from './providers/provider';
import { buildVietQr } from './providers/vietqr';
import { vnpay } from './providers/vnpay';
import { zalopay } from './providers/zalopay';
import { decryptSecrets, encryptSecrets, maskSecret } from './secrets';

type Tx = Prisma.TransactionClient;
interface Actor {
  id: string;
}

export const PROVIDERS: Record<
  Exclude<QrProviderName, 'vietqr'>,
  QrProvider
> = { momo, zalopay, vnpay };
export const METHOD_OF: Record<QrProviderName, string> = {
  vietqr: 'bank_transfer',
  momo: 'ewallet_momo',
  zalopay: 'ewallet_zalopay',
  vnpay: 'ewallet_vnpay',
};
export const SECRET_FIELDS: Record<QrProviderName, string[]> = {
  vietqr: ['webhook_secret'],
  momo: ['access_key', 'secret_key'],
  zalopay: ['key1', 'key2'],
  vnpay: ['hash_secret'],
};
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () =>
  `QR${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;
const num = (v: Prisma.Decimal | number) => Number(v);

/** Default HTTP: JSON or form POST with a 10 s timeout. */
export const defaultPost: HttpPost = async (url, body, form) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': form
        ? 'application/x-www-form-urlencoded'
        : 'application/json',
    },
    body: form
      ? new URLSearchParams(
          Object.entries(body as Record<string, unknown>).map(([k, v]) => [
            k,
            str(v),
          ]),
        ).toString()
      : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  return res.json();
};

export type Outcome = 'ok' | 'invalid' | 'unknown' | 'duplicate' | 'amount';

/** QR payment requests, provider callbacks and settings (change ewallet-qr-payments). */
@Injectable()
export class QrPaymentsService {
  /** Replaceable in tests (fake provider). */
  http: HttpPost = defaultPost;

  constructor(private readonly prisma: PrismaService) {}

  // ---------- settings ----------

  private async settingsRow(storeId: string, provider: QrProviderName) {
    return this.prisma.qr_provider_settings.findFirst({
      where: { store_id: storeId, provider },
    });
  }

  async providerSettings(
    storeId: string,
    provider: QrProviderName,
  ): Promise<
    ProviderSettings & { cash_account_id: string | null; is_enabled: boolean }
  > {
    const row = await this.settingsRow(storeId, provider);
    return {
      config: (row?.config ?? {}) as Record<string, unknown>,
      secrets: decryptSecrets(row?.secrets),
      cash_account_id: row?.cash_account_id ?? null,
      is_enabled: row?.is_enabled ?? false,
    };
  }

  callbackUrl(provider: string, storeId?: string) {
    const base = (
      process.env.PUBLIC_API_URL ?? 'http://localhost:3001'
    ).replace(/\/$/, '');
    return provider === 'bank'
      ? `${base}/api/qr-payments/callbacks/bank/${storeId}`
      : `${base}/api/qr-payments/callbacks/${provider}`;
  }

  async listSettings(storeId: string) {
    const rows = await this.prisma.qr_provider_settings.findMany({
      where: { store_id: storeId },
    });
    return (['vietqr', 'momo', 'zalopay', 'vnpay'] as QrProviderName[]).map(
      (provider) => {
        const row = rows.find((r) => r.provider === provider);
        const secrets = decryptSecrets(row?.secrets);
        return {
          provider,
          is_enabled: row?.is_enabled ?? false,
          config: (row?.config ?? {}) as Record<string, unknown>,
          cash_account_id: row?.cash_account_id ?? null,
          secrets: Object.fromEntries(
            SECRET_FIELDS[provider].map((f) => [f, maskSecret(secrets[f])]),
          ),
          callback_url: this.callbackUrl(
            provider === 'vietqr' ? 'bank' : provider,
            storeId,
          ),
        };
      },
    );
  }

  /** Empty secret fields keep the stored value; secrets are stored encrypted. */
  async saveSettings(
    actor: Actor,
    storeId: string,
    provider: QrProviderName,
    dto: {
      is_enabled?: boolean;
      config?: Record<string, unknown>;
      secrets?: Record<string, string>;
      cash_account_id?: string | null;
    },
  ) {
    if (dto.cash_account_id) {
      const acc = await this.prisma.cash_book_accounts.findFirst({
        where: { id: dto.cash_account_id },
      });
      if (!acc || acc.store_id !== storeId || !acc.is_active)
        throw new BadRequestException(
          'Tài khoản sổ quỹ phải thuộc chi nhánh này và đang dùng',
        );
    }
    const row = await this.settingsRow(storeId, provider);
    const current = decryptSecrets(row?.secrets);
    const incoming = Object.fromEntries(
      Object.entries(dto.secrets ?? {}).filter(
        ([k, v]) => SECRET_FIELDS[provider].includes(k) && v,
      ),
    );
    const merged = { ...current, ...incoming };
    const secrets = Object.keys(incoming).length
      ? encryptSecrets(merged)
      : (row?.secrets ?? null);
    const data = {
      is_enabled: dto.is_enabled ?? row?.is_enabled ?? false,
      config: (dto.config ?? row?.config ?? {}) as Prisma.InputJsonValue,
      secrets,
      cash_account_id:
        dto.cash_account_id === undefined
          ? (row?.cash_account_id ?? null)
          : dto.cash_account_id,
      updated_by: actor.id,
      updated_at: new Date(),
    };
    if (row)
      await this.prisma.qr_provider_settings.update({
        where: { id: row.id },
        data,
      });
    else
      await this.prisma.qr_provider_settings.create({
        data: { ...data, store_id: storeId, provider },
      });
    return (await this.listSettings(storeId)).find(
      (s) => s.provider === provider,
    );
  }

  async enabledProviders(storeId: string) {
    const rows = await this.prisma.qr_provider_settings.findMany({
      where: { store_id: storeId, is_enabled: true },
      select: { provider: true },
    });
    return rows.map((r) => ({
      provider: r.provider,
      method: METHOD_OF[r.provider as QrProviderName],
    }));
  }

  // ---------- requests ----------

  async create(
    actor: Actor,
    dto: {
      store_id: string;
      provider: QrProviderName;
      amount: number;
      client_request_id?: string;
      pos_session_id?: string;
    },
  ) {
    const s = await this.providerSettings(dto.store_id, dto.provider);
    if (!s.is_enabled)
      throw new BadRequestException(
        'Phương thức QR này chưa được bật cho chi nhánh',
      );
    const store = await this.prisma.stores.findFirst({
      where: { id: dto.store_id },
      select: { code: true },
    });
    const now = new Date();
    const minutes = Number(s.config.expiry_minutes ?? 10) || 10;
    const req: ProviderRequest = {
      code: newCode(),
      amount: Math.round(dto.amount),
      description: '',
      createdAt: now,
      expiresAt: new Date(now.getTime() + minutes * 60_000),
    };
    req.description = `${req.code} SCMC ${store?.code ?? ''}`.trim();
    let created: {
      qr_content: string;
      pay_url?: string | null;
      provider_ref?: string | null;
      raw?: unknown;
    };
    if (dto.provider === 'vietqr') {
      if (!s.config.bank_bin || !s.config.account_number)
        throw new BadRequestException('Chưa cấu hình số tài khoản VietQR');
      created = {
        qr_content: buildVietQr({
          bankBin: str(s.config.bank_bin),
          accountNumber: str(s.config.account_number),
          amount: req.amount,
          description: req.description,
        }),
      };
    } else {
      const urls = {
        callbackUrl: this.callbackUrl(dto.provider),
        returnUrl: process.env.PUBLIC_APP_URL ?? this.callbackUrl(dto.provider),
      };
      try {
        created = await PROVIDERS[dto.provider].create(req, s, urls, this.http);
      } catch (e) {
        await this.event(
          null,
          dto.provider,
          'create',
          { code: req.code, error: (e as Error).message },
          null,
          actor.id,
        );
        throw new BadRequestException(
          `Không tạo được mã QR: ${(e as Error).message}`,
        );
      }
    }
    const row = await this.prisma.qr_payment_requests.create({
      data: {
        code: req.code,
        store_id: dto.store_id,
        pos_session_id: dto.pos_session_id ?? null,
        provider: dto.provider,
        method: METHOD_OF[dto.provider],
        amount: new Prisma.Decimal(req.amount),
        qr_content: created.qr_content,
        pay_url: created.pay_url ?? null,
        provider_ref: created.provider_ref ?? null,
        client_request_id: dto.client_request_id ?? null,
        expires_at: req.expiresAt,
        created_by: actor.id,
      },
    });
    await this.event(
      row.id,
      dto.provider,
      'create',
      { response: created.raw ?? null },
      null,
      actor.id,
    );
    return this.shape(row);
  }

  /** Current state; a pending request past its expiry is checked with the provider, then expired. */
  async get(id: string) {
    let r = await this.find(id);
    if (r.status === 'pending' && r.expires_at < new Date()) {
      if (r.provider !== 'vietqr')
        await this.check({ id: 'system' }, id, true).catch(() => undefined);
      r = await this.find(id);
      if (r.status === 'pending') {
        await this.transition(id, { status: 'expired' });
        await this.event(id, r.provider, 'expire', {}, null, null);
        r = await this.find(id);
      }
    }
    return this.shape(r);
  }

  /** Asks the provider (MoMo, ZaloPay) for the status and applies it. */
  async check(actor: Actor, id: string, silent = false) {
    const r = await this.find(id);
    const p =
      r.provider === 'vietqr'
        ? null
        : PROVIDERS[r.provider as Exclude<QrProviderName, 'vietqr'>];
    if (r.status === 'pending' && p?.query) {
      const s = await this.providerSettings(
        r.store_id,
        r.provider as QrProviderName,
      );
      const q = await p.query(
        {
          code: r.code,
          amount: num(r.amount),
          description: '',
          createdAt: r.created_at,
          expiresAt: r.expires_at,
        },
        s,
        this.http,
      );
      await this.event(
        id,
        r.provider,
        'query',
        { result: q.raw ?? { paid: q.paid, failed: q.failed } },
        null,
        actor.id === 'system' ? null : actor.id,
      );
      await this.apply(id, {
        paid: q.paid,
        failed: q.failed,
        amount: q.amount,
        providerRef: q.providerRef,
      });
    }
    return silent ? undefined : this.shape(await this.find(id));
  }

  /** VietQR: staff saw the transfer arrive (design D5). */
  async confirm(actor: Actor, id: string) {
    const r = await this.find(id);
    if (r.provider !== 'vietqr')
      throw new BadRequestException(
        'Chỉ xác nhận tay cho chuyển khoản VietQR; ví điện tử xác nhận qua nhà cung cấp',
      );
    if (r.status !== 'pending')
      throw new ConflictException(`Yêu cầu đang ở trạng thái ${r.status}`);
    await this.transition(id, {
      status: 'paid',
      paid_at: new Date(),
      confirmed_by: actor.id,
    });
    await this.event(id, r.provider, 'manual_confirm', {}, null, actor.id);
    return this.shape(await this.find(id));
  }

  async cancel(actor: Actor, id: string) {
    const r = await this.find(id);
    if (r.status !== 'pending')
      throw new ConflictException(`Yêu cầu đang ở trạng thái ${r.status}`);
    await this.transition(id, { status: 'cancelled' });
    await this.event(id, r.provider, 'cancel', {}, null, actor.id);
    return this.shape(await this.find(id));
  }

  // ---------- callbacks ----------

  async callback(
    provider: Exclude<QrProviderName, 'vietqr'>,
    input: CallbackInput,
  ): Promise<{ status: number; body?: unknown }> {
    const p = PROVIDERS[provider];
    const code = p.codeOf(input);
    const r = code
      ? await this.prisma.qr_payment_requests.findFirst({
          where: { code, provider },
        })
      : null;
    if (!r) {
      await this.event(
        null,
        provider,
        'callback',
        this.safePayload(input),
        null,
        null,
      );
      return p.reply(null, 'unknown');
    }
    const result = p.verify(
      input,
      await this.providerSettings(r.store_id, provider),
    );
    await this.event(
      r.id,
      provider,
      'callback',
      this.safePayload(input),
      result.signatureOk,
      null,
    );
    if (!result.signatureOk) return p.reply(result, 'invalid');
    return p.reply(result, await this.apply(r.id, result));
  }

  /** Bank-notification webhook for VietQR of one branch. */
  async bankWebhook(
    storeId: string,
    input: CallbackInput,
  ): Promise<{ status: number; body?: unknown }> {
    const s = await this.providerSettings(storeId, 'vietqr');
    const result = verifyBankWebhook(input, s.secrets.webhook_secret);
    const r = result.code
      ? await this.prisma.qr_payment_requests.findFirst({
          where: { code: result.code, provider: 'vietqr', store_id: storeId },
        })
      : null;
    await this.event(
      r?.id ?? null,
      'vietqr',
      'webhook',
      this.safePayload(input),
      result.signatureOk,
      null,
    );
    if (!result.signatureOk)
      return {
        status: 401,
        body: { success: false, message: 'invalid signature' },
      };
    if (!r) return { status: 200, body: { success: true, matched: false } };
    const outcome = await this.apply(r.id, result);
    return { status: 200, body: { success: true, matched: true, outcome } };
  }

  /** pending → paid | failed only; anything else is a duplicate (design D3). */
  private async apply(
    id: string,
    r: Pick<CallbackResult, 'paid' | 'failed' | 'amount' | 'providerRef'>,
  ): Promise<Outcome> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM qr_payment_requests WHERE id = ${id}::uuid FOR UPDATE`;
      const cur = await tx.qr_payment_requests.findFirstOrThrow({
        where: { id },
      });
      if (cur.status !== 'pending') return 'duplicate';
      if (r.paid) {
        if (
          r.amount != null &&
          Math.round(r.amount) !== Math.round(num(cur.amount))
        ) {
          await this.transition(
            id,
            {
              status: 'failed',
              failure_reason: `Số tiền nhận ${r.amount} khác ${num(cur.amount)}`,
            },
            tx,
          );
          return 'amount';
        }
        await this.transition(
          id,
          {
            status: 'paid',
            paid_at: new Date(),
            provider_ref: r.providerRef || cur.provider_ref,
          },
          tx,
        );
        return 'ok';
      }
      if (r.failed)
        await this.transition(
          id,
          { status: 'failed', failure_reason: 'Nhà cung cấp báo thất bại' },
          tx,
        );
      return 'ok';
    });
  }

  private transition(
    id: string,
    data: Prisma.qr_payment_requestsUncheckedUpdateInput,
    tx: Tx | PrismaService = this.prisma,
  ) {
    return tx.qr_payment_requests.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
    });
  }

  private async find(id: string) {
    const r = await this.prisma.qr_payment_requests.findFirst({
      where: { id },
    });
    if (!r) throw new NotFoundException('Không tìm thấy yêu cầu thanh toán QR');
    return r;
  }

  private shape(r: Prisma.qr_payment_requestsGetPayload<object>) {
    return { ...r, amount: num(r.amount) };
  }

  private safePayload(i: CallbackInput) {
    return { body: i.body, query: i.query } as Prisma.InputJsonValue;
  }

  private event(
    requestId: string | null,
    provider: string,
    kind: string,
    payload: unknown,
    signatureOk: boolean | null,
    by: string | null,
  ) {
    return this.prisma.qr_payment_events.create({
      data: {
        request_id: requestId,
        provider,
        kind,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        signature_ok: signatureOk,
        created_by: by,
      },
    });
  }
}
