import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { duplicate } from '../price-books/customer-groups.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionInputDto } from './dto/promotions.dto';

const dec = (v: number | null | undefined) =>
  v == null ? (v as null | undefined) : new Prisma.Decimal(v);
const date = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : new Date(v);
/** TIME column from "HH:MM". */
const time = (v: string | null | undefined) =>
  v === undefined
    ? undefined
    : v === null || v === ''
      ? null
      : new Date(`1970-01-01T${v}:00Z`);
const hhmm = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : null);
const num = (v: Prisma.Decimal | null) => (v == null ? null : Number(v));

const include = {
  promotion_targets: true,
  promotion_stores: {
    include: { stores: { select: { id: true, name: true } } },
  },
  promotion_customer_groups: {
    include: { customer_groups: { select: { id: true, name: true } } },
  },
} satisfies Prisma.promotionsInclude;
type Row = Prisma.promotionsGetPayload<{ include: typeof include }>;

/** Promotions management (spec pricing/promotions). */
@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.promotions.findMany({
      include,
      orderBy: [{ is_active: 'desc' }, { priority: 'desc' }, { code: 'asc' }],
    });
    const usage = await this.usage(rows.map((r) => r.id));
    return rows.map((r) => ({
      ...this.shape(r),
      usage: usage.get(r.id) ?? { orders: 0, discount: 0 },
    }));
  }

  async get(id: string) {
    const r = await this.prisma.promotions.findFirst({
      where: { id },
      include,
    });
    if (!r) throw new NotFoundException('Không tìm thấy khuyến mãi');
    const usage = (await this.usage([id])).get(id) ?? {
      orders: 0,
      discount: 0,
    };
    return {
      ...this.shape(r),
      usage,
      target_names: await this.targetNames(r.promotion_targets),
    };
  }

  async create(actorId: string, dto: PromotionInputDto) {
    if (!dto.code || !dto.name || !dto.type)
      throw new BadRequestException('Cần mã, tên và loại khuyến mãi');
    this.checkShape(dto);
    try {
      const r = await this.prisma.promotions.create({
        data: {
          ...this.fields(dto),
          code: dto.code,
          name: dto.name,
          type: dto.type,
          created_by: actorId,
          updated_by: actorId,
          promotion_targets: {
            create: (dto.targets ?? []).map((t) => ({
              ...t,
              quantity: t.quantity ?? 1,
            })),
          },
          promotion_stores: {
            create: (dto.store_ids ?? []).map((store_id) => ({ store_id })),
          },
          promotion_customer_groups: {
            create: (dto.group_ids ?? []).map((group_id) => ({ group_id })),
          },
        } as Prisma.promotionsUncheckedCreateInput,
      });
      return this.get(r.id);
    } catch (e) {
      throw duplicate(e, `Mã khuyến mãi ${dto.code} đã tồn tại`);
    }
  }

  async update(actorId: string, id: string, dto: PromotionInputDto) {
    const current = await this.get(id);
    this.checkShape({
      ...this.asInput(current),
      ...dto,
      type: current.type as PromotionInputDto['type'],
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.promotions.update({
        where: { id },
        data: {
          ...this.fields(dto),
          name: dto.name,
          updated_by: actorId,
          updated_at: new Date(),
        } as Prisma.promotionsUncheckedUpdateInput,
      });
      if (dto.targets) {
        await tx.promotion_targets.deleteMany({ where: { promotion_id: id } });
        await tx.promotion_targets.createMany({
          data: dto.targets.map((t) => ({
            ...t,
            quantity: t.quantity ?? 1,
            promotion_id: id,
          })),
        });
      }
      if (dto.store_ids) {
        await tx.promotion_stores.deleteMany({ where: { promotion_id: id } });
        await tx.promotion_stores.createMany({
          data: dto.store_ids.map((store_id) => ({
            promotion_id: id,
            store_id,
          })),
        });
      }
      if (dto.group_ids) {
        await tx.promotion_customer_groups.deleteMany({
          where: { promotion_id: id },
        });
        await tx.promotion_customer_groups.createMany({
          data: dto.group_ids.map((group_id) => ({
            promotion_id: id,
            group_id,
          })),
        });
      }
    });
    return this.get(id);
  }

  /** A promotion already used by orders is kept for their history: deactivate it instead. */
  async remove(id: string) {
    await this.get(id);
    const used = await this.prisma.sales_order_discounts.count({
      where: { promotion_id: id },
    });
    if (used)
      throw new ConflictException(
        `Khuyến mãi đã dùng cho ${used} dòng đơn hàng; hãy ngừng áp dụng thay vì xóa`,
      );
    await this.prisma.promotions.delete({ where: { id } });
    return { id };
  }

  private fields(dto: PromotionInputDto) {
    return {
      priority: dto.priority,
      is_active: dto.is_active,
      start_at: date(dto.start_at),
      end_at: date(dto.end_at),
      days_of_week: dto.days_of_week,
      time_from: time(dto.time_from),
      time_to: time(dto.time_to),
      channels: dto.channels,
      combinable: dto.combinable,
      discount_kind: dto.discount_kind,
      discount_value: dec(dto.discount_value),
      max_discount: dec(dto.max_discount),
      min_order_amount: dec(dto.min_order_amount),
      buy_quantity: dto.buy_quantity,
      get_quantity: dto.get_quantity,
      get_discount_percent: dec(dto.get_discount_percent),
      bundle_price: dec(dto.bundle_price),
      notes: dto.notes,
      ...(dto.store_ids ? { all_stores: dto.store_ids.length === 0 } : {}),
      ...(dto.group_ids ? { all_customers: dto.group_ids.length === 0 } : {}),
    };
  }

  /** Readable errors before the database constraint fires. */
  private checkShape(d: PromotionInputDto) {
    const targets = d.targets ?? [];
    const has = (role: string) => targets.some((t) => t.role === role);
    if (d.start_at && d.end_at && new Date(d.end_at) < new Date(d.start_at))
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    if (d.discount_kind === 'percent' && (d.discount_value ?? 0) > 100)
      throw new BadRequestException('Phần trăm giảm tối đa 100');
    switch (d.type) {
      case 'line_discount':
        if (!d.discount_kind || d.discount_value == null)
          throw new BadRequestException('Cần cách giảm và giá trị giảm');
        if (!has('target'))
          throw new BadRequestException(
            'Chọn sản phẩm, danh mục hoặc thương hiệu được giảm',
          );
        break;
      case 'order_discount':
        if (
          !d.discount_kind ||
          d.discount_kind === 'fixed_price' ||
          d.discount_value == null
        )
          throw new BadRequestException(
            'Giảm theo đơn cần giảm % hoặc số tiền',
          );
        break;
      case 'buy_x_get_y':
        if (!d.buy_quantity || !d.get_quantity || !d.get_discount_percent)
          throw new BadRequestException(
            'Cần số lượng mua, số lượng tặng và % giảm cho hàng tặng',
          );
        if (!has('target') && !has('buy'))
          throw new BadRequestException('Chọn hàng phải mua');
        break;
      case 'bundle':
        if (d.bundle_price == null)
          throw new BadRequestException('Cần giá combo');
        if (targets.filter((t) => t.role === 'bundle').length < 2)
          throw new BadRequestException('Combo cần ít nhất 2 sản phẩm');
        if (
          targets.some(
            (t) =>
              t.role === 'bundle' &&
              (t.target_type === 'category' || t.target_type === 'brand'),
          )
        )
          throw new BadRequestException(
            'Thành phần combo phải là sản phẩm hoặc biến thể',
          );
        break;
    }
  }

  private shape(r: Row) {
    const {
      promotion_stores,
      promotion_customer_groups,
      promotion_targets,
      ...p
    } = r;
    return {
      ...p,
      discount_value: num(p.discount_value),
      max_discount: num(p.max_discount),
      min_order_amount: num(p.min_order_amount),
      get_discount_percent: num(p.get_discount_percent),
      bundle_price: num(p.bundle_price),
      time_from: hhmm(p.time_from),
      time_to: hhmm(p.time_to),
      stores: promotion_stores.map((s) => s.stores),
      groups: promotion_customer_groups.map((g) => g.customer_groups),
      targets: promotion_targets.map(
        ({ role, target_type, target_id, quantity }) => ({
          role,
          target_type,
          target_id,
          quantity,
        }),
      ),
    };
  }

  private asInput(
    p: ReturnType<PromotionsService['shape']>,
  ): PromotionInputDto {
    return {
      ...p,
      start_at: p.start_at?.toISOString() ?? null,
      end_at: p.end_at?.toISOString() ?? null,
      discount_kind: p.discount_kind as PromotionInputDto['discount_kind'],
      targets: p.targets as PromotionInputDto['targets'],
      type: p.type as PromotionInputDto['type'],
      notes: p.notes ?? undefined,
      days_of_week: p.days_of_week ?? undefined,
      channels: p.channels ?? undefined,
    };
  }

  /** Orders and total discount per promotion. */
  private async usage(ids: string[]) {
    if (!ids.length)
      return new Map<string, { orders: number; discount: number }>();
    const rows = await this.prisma.$queryRaw<
      { promotion_id: string; orders: number; discount: Prisma.Decimal }[]
    >`
      SELECT d.promotion_id, COUNT(DISTINCT d.sales_order_id)::int AS orders, SUM(d.amount) AS discount
      FROM sales_order_discounts d JOIN sales_orders o ON o.id = d.sales_order_id
      WHERE d.promotion_id = ANY(${ids}::uuid[]) AND o.status <> 'cancelled'
      GROUP BY d.promotion_id`;
    return new Map(
      rows.map((r) => [
        r.promotion_id,
        { orders: r.orders, discount: Number(r.discount) },
      ]),
    );
  }

  private async targetNames(
    targets: { target_type: string; target_id: string }[],
  ) {
    const ids = (t: string) =>
      targets.filter((x) => x.target_type === t).map((x) => x.target_id);
    const [products, variants, categories, brands] = await Promise.all([
      this.prisma.products.findMany({
        where: { id: { in: ids('product') } },
        select: { id: true, name: true, sku: true },
      }),
      this.prisma.product_variants.findMany({
        where: { id: { in: ids('variant') } },
        select: { id: true, name: true, sku: true },
      }),
      this.prisma.product_categories.findMany({
        where: { id: { in: ids('category') } },
        select: { id: true, name: true },
      }),
      this.prisma.brands.findMany({
        where: { id: { in: ids('brand') } },
        select: { id: true, name: true },
      }),
    ]);
    const out: Record<string, string> = {};
    for (const p of [...products, ...variants])
      out[p.id] = `${p.name} (${p.sku})`;
    for (const c of [...categories, ...brands]) out[c.id] = c.name;
    return out;
  }
}
