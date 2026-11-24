import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { duplicate } from '../price-books/customer-groups.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CampaignInputDto,
  CodesQueryDto,
  GenerateCodesDto,
  VoucherCheckQueryDto,
} from './dto/promotions.dto';
import { checkVoucher } from './promotion-engine';
import { loadVoucher } from './promotion-loader';

const dec = (v: number | null | undefined) =>
  v == null ? (v as null | undefined) : new Prisma.Decimal(v);
const date = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : new Date(v);
const num = (v: Prisma.Decimal | null) => (v == null ? null : Number(v));
/** No 0/O, 1/I/L: codes are read aloud and typed by hand. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = (prefix: string, len = 6) =>
  prefix +
  Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    '',
  );

/** Voucher campaigns, codes and the staff check (spec pricing/vouchers). */
@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.voucher_campaigns.findMany({
      include: {
        voucher_campaign_stores: {
          include: { stores: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ is_active: 'desc' }, { created_at: 'desc' }],
    });
    const stats = await this.stats(rows.map((r) => r.id));
    return rows.map((r) => ({
      ...this.shape(r),
      stats: stats.get(r.id) ?? {
        codes: 0,
        used_codes: 0,
        uses: 0,
        discount: 0,
      },
    }));
  }

  async get(id: string) {
    const r = await this.prisma.voucher_campaigns.findFirst({
      where: { id },
      include: {
        voucher_campaign_stores: {
          include: { stores: { select: { id: true, name: true } } },
        },
      },
    });
    if (!r) throw new NotFoundException('Không tìm thấy chương trình voucher');
    return {
      ...this.shape(r),
      stats: (await this.stats([id])).get(id) ?? {
        codes: 0,
        used_codes: 0,
        uses: 0,
        discount: 0,
      },
    };
  }

  async create(actorId: string, dto: CampaignInputDto) {
    if (
      !dto.code ||
      !dto.name ||
      !dto.discount_kind ||
      dto.discount_value == null
    )
      throw new BadRequestException('Cần mã, tên, cách giảm và giá trị');
    this.validateInput(dto);
    try {
      const r = await this.prisma.voucher_campaigns.create({
        data: {
          ...this.fields(dto),
          code: dto.code,
          name: dto.name,
          discount_kind: dto.discount_kind,
          discount_value: new Prisma.Decimal(dto.discount_value),
          created_by: actorId,
          updated_by: actorId,
          voucher_campaign_stores: {
            create: (dto.store_ids ?? []).map((store_id) => ({ store_id })),
          },
        } as Prisma.voucher_campaignsUncheckedCreateInput,
      });
      return this.get(r.id);
    } catch (e) {
      throw duplicate(e, `Mã chương trình ${dto.code} đã tồn tại`);
    }
  }

  async update(actorId: string, id: string, dto: CampaignInputDto) {
    const current = await this.get(id);
    this.validateInput({
      ...dto,
      discount_kind:
        dto.discount_kind ?? (current.discount_kind as 'percent' | 'amount'),
      discount_value: dto.discount_value ?? current.discount_value,
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.voucher_campaigns.update({
        where: { id },
        data: {
          ...this.fields(dto),
          name: dto.name,
          discount_kind: dto.discount_kind,
          discount_value: dec(dto.discount_value) ?? undefined,
          updated_by: actorId,
          updated_at: new Date(),
        } as Prisma.voucher_campaignsUncheckedUpdateInput,
      });
      if (dto.store_ids) {
        await tx.voucher_campaign_stores.deleteMany({
          where: { campaign_id: id },
        });
        await tx.voucher_campaign_stores.createMany({
          data: dto.store_ids.map((store_id) => ({
            campaign_id: id,
            store_id,
          })),
        });
      }
    });
    return this.get(id);
  }

  async remove(id: string) {
    await this.get(id);
    const used = await this.prisma.voucher_redemptions.count({
      where: { campaign_id: id },
    });
    if (used)
      throw new ConflictException(
        `Chương trình đã được dùng ${used} lần; hãy ngừng áp dụng thay vì xóa`,
      );
    await this.prisma.voucher_campaigns.delete({ where: { id } });
    return { id };
  }

  /** One given code, or `count` random codes with a prefix (unique, retried on collision). */
  async generate(id: string, dto: GenerateCodesDto) {
    const campaign = await this.get(id);
    if (dto.code) {
      try {
        await this.prisma.vouchers.create({
          data: { campaign_id: id, code: dto.code },
        });
      } catch (e) {
        throw duplicate(e, `Mã ${dto.code} đã tồn tại`);
      }
      return { created: 1, codes: [dto.code] };
    }
    const count = dto.count ?? 0;
    if (count < 1)
      throw new BadRequestException('Nhập một mã hoặc số lượng mã cần tạo');
    const prefix = dto.prefix ?? campaign.code;
    const created: string[] = [];
    for (let attempt = 0; created.length < count && attempt < 10; attempt++) {
      const batch = new Set<string>();
      while (batch.size < count - created.length) batch.add(randomCode(prefix));
      const res = await this.prisma.vouchers.createMany({
        data: [...batch].map((code) => ({ campaign_id: id, code })),
        skipDuplicates: true,
      });
      const kept = await this.prisma.vouchers.findMany({
        where: { campaign_id: id, code: { in: [...batch] } },
        select: { code: true },
      });
      created.push(...kept.map((k) => k.code));
      if (res.count === batch.size) break;
    }
    return { created: created.length, codes: created };
  }

  async codes(id: string, q: CodesQueryDto) {
    await this.get(id);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 100;
    const where: Prisma.vouchersWhereInput = {
      campaign_id: id,
      ...(q.search
        ? { code: { contains: q.search.trim().toUpperCase() } }
        : {}),
      ...(q.status === 'used'
        ? { used_count: { gt: 0 } }
        : q.status === 'unused'
          ? { used_count: 0 }
          : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.vouchers.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vouchers.count({ where }),
    ]);
    return { data, pagination: { page, pageSize, total } };
  }

  async setCodeActive(id: string, codeId: string, isActive: boolean) {
    const { count } = await this.prisma.vouchers.updateMany({
      where: { id: codeId, campaign_id: id },
      data: { is_active: isActive },
    });
    if (!count) throw new NotFoundException('Không tìm thấy mã');
    return { id: codeId, is_active: isActive };
  }

  /** CSV of every code with its uses, for printing or sharing. */
  async exportCsv(id: string): Promise<{ csv: string; fileName: string }> {
    const campaign = await this.get(id);
    const rows = await this.prisma.vouchers.findMany({
      where: { campaign_id: id },
      orderBy: { created_at: 'asc' },
    });
    const lines = [
      'Code,Active,Used',
      ...rows.map(
        (r) => `${r.code},${r.is_active ? 'yes' : 'no'},${r.used_count}`,
      ),
    ];
    return {
      csv: '﻿' + lines.join('\r\n'),
      fileName: `voucher-${campaign.code}.csv`,
    };
  }

  /** Staff check of a code before checkout (reasons as at checkout, promotions not considered). */
  async check(q: VoucherCheckQueryDto) {
    const loaded = await loadVoucher(
      this.prisma as unknown as Prisma.TransactionClient,
      q.code,
      q.customer_id,
    );
    if (!loaded) return { ok: false, reason: 'Mã không tồn tại' };
    const r = checkVoucher(loaded.rule, {
      at: new Date(),
      storeId: q.store_id,
      channel: q.channel,
      customerId: q.customer_id,
      base: q.amount ?? Number.MAX_SAFE_INTEGER,
      promotionsApplied: false,
    });
    return {
      ...r,
      code: loaded.code,
      campaign: loaded.campaignName,
      rule: { ...loaded.rule, used_count: loaded.rule.used_count },
    };
  }

  private validateInput(dto: CampaignInputDto) {
    if (dto.discount_kind === 'percent' && (dto.discount_value ?? 0) > 100)
      throw new BadRequestException('Phần trăm giảm tối đa 100');
    if (
      dto.start_at &&
      dto.end_at &&
      new Date(dto.end_at) < new Date(dto.start_at)
    )
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
  }

  private fields(dto: CampaignInputDto) {
    return {
      max_discount: dec(dto.max_discount),
      min_order_amount: dec(dto.min_order_amount),
      start_at: date(dto.start_at),
      end_at: date(dto.end_at),
      channels: dto.channels,
      uses_per_code: dto.uses_per_code,
      uses_per_customer: dto.uses_per_customer,
      combinable_with_promotions: dto.combinable_with_promotions,
      is_active: dto.is_active,
      notes: dto.notes,
      ...(dto.store_ids ? { all_stores: dto.store_ids.length === 0 } : {}),
    };
  }

  private shape(
    r: Prisma.voucher_campaignsGetPayload<{
      include: {
        voucher_campaign_stores: {
          include: { stores: { select: { id: true; name: true } } };
        };
      };
    }>,
  ) {
    const { voucher_campaign_stores, ...c } = r;
    return {
      ...c,
      discount_value: num(c.discount_value),
      max_discount: num(c.max_discount),
      min_order_amount: num(c.min_order_amount),
      stores: voucher_campaign_stores.map((s) => s.stores),
    };
  }

  private async stats(ids: string[]) {
    if (!ids.length)
      return new Map<
        string,
        { codes: number; used_codes: number; uses: number; discount: number }
      >();
    const rows = await this.prisma.$queryRaw<
      {
        campaign_id: string;
        codes: number;
        used_codes: number;
        uses: number;
        discount: Prisma.Decimal | null;
      }[]
    >`
      SELECT v.campaign_id,
             COUNT(*)::int AS codes,
             COUNT(*) FILTER (WHERE v.used_count > 0)::int AS used_codes,
             COALESCE(SUM(v.used_count), 0)::int AS uses,
             (SELECT SUM(r.amount) FROM voucher_redemptions r WHERE r.campaign_id = v.campaign_id AND r.status = 'applied') AS discount
      FROM vouchers v WHERE v.campaign_id = ANY(${ids}::uuid[])
      GROUP BY v.campaign_id`;
    return new Map(
      rows.map((r) => [
        r.campaign_id,
        {
          codes: r.codes,
          used_codes: r.used_codes,
          uses: r.uses,
          discount: Number(r.discount ?? 0),
        },
      ]),
    );
  }
}
