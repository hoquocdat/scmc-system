import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ensureStockRow,
  lockStock,
  nextDocumentNumber,
  StockItem,
} from '../inventory/stock-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CodesService } from './codes.service';
import { CountEntryDto, StartCountDto } from './dto/stock-operations.dto';
import { describeItems, keyOf, movementItem } from './item-names';

type Tx = Prisma.TransactionClient;
interface Actor {
  id: string;
}

/** Stock counts (kiểm kho) — spec inventory/stock-counts, design D3. */
@Injectable()
export class CountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodesService,
    private readonly activity: ActivityLogsService,
  ) {}

  async list(locationId?: string) {
    const rows = await this.prisma.stock_counts.findMany({
      where: locationId ? { location_id: locationId } : {},
      include: {
        stock_locations: { select: { id: true, name: true } },
        _count: { select: { stock_count_items: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    const counted = await this.prisma.stock_count_items.groupBy({
      by: ['stock_count_id'],
      where: {
        stock_count_id: { in: rows.map((r) => r.id) },
        counted_quantity: { not: null },
      },
      _count: true,
    });
    const byId = new Map(counted.map((c) => [c.stock_count_id, c._count]));
    return rows.map(({ _count, ...r }) => ({
      ...r,
      item_count: _count.stock_count_items,
      counted_count: byId.get(r.id) ?? 0,
    }));
  }

  async get(id: string) {
    const c = await this.prisma.stock_counts.findFirst({
      where: { id },
      include: {
        stock_locations: { select: { id: true, name: true } },
        stock_count_items: true,
      },
    });
    if (!c) throw new NotFoundException('Không tìm thấy phiếu kiểm kho');
    const info = await describeItems(
      this.prisma as unknown as Tx,
      c.stock_count_items.map(itemOf),
    );
    const items = c.stock_count_items
      .map((i) => {
        const d = info.get(keyOf(itemOf(i)));
        const diff =
          i.counted_quantity == null
            ? null
            : (i.adjustment ??
              i.counted_quantity - (i.system_at_count ?? i.system_quantity));
        const cost = Number(i.unit_cost ?? d.cost);
        return {
          id: i.id,
          product_id: i.product_id,
          product_variant_id: i.product_variant_id,
          name: d.name,
          sku: d.sku,
          barcode: d.barcode,
          system_quantity: i.system_quantity,
          system_at_count: i.system_at_count,
          counted_quantity: i.counted_quantity,
          counted_at: i.counted_at,
          difference: diff,
          difference_value: diff == null ? null : diff * cost,
          unit_cost: cost,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const diffs = items.filter((i) => i.difference);
    return {
      ...c,
      stock_count_items: undefined,
      items,
      summary: {
        items: items.length,
        counted: items.filter((i) => i.counted_quantity != null).length,
        surplus: diffs
          .filter((i) => i.difference > 0)
          .reduce((s, i) => s + i.difference, 0),
        shortage: diffs
          .filter((i) => i.difference < 0)
          .reduce((s, i) => s - i.difference, 0),
        value: diffs.reduce((s, i) => s + i.difference_value, 0),
      },
    };
  }

  async start(actor: Actor, dto: StartCountDto) {
    const items = await this.scopeItems(dto);
    if (!items.length)
      throw new BadRequestException('Không có mặt hàng nào trong phạm vi kiểm');
    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          const c = await tx.stock_counts.create({
            data: {
              count_number: await nextDocumentNumber(tx, 'KK'),
              location_id: dto.location_id,
              scope: dto.scope as unknown as Prisma.InputJsonValue,
              note: dto.note,
              created_by: actor.id,
            },
          });
          const info = await describeItems(tx, items);
          for (const i of items) {
            await ensureStockRow(tx, dto.location_id, i);
            const s = await lockStock(tx, dto.location_id, i);
            await tx.stock_count_items.create({
              data: {
                stock_count_id: c.id,
                ...movementItem(i),
                system_quantity: s.onHand,
                unit_cost: new Prisma.Decimal(info.get(keyOf(i)).cost),
              },
            });
          }
          return c.id;
        },
        { timeout: 60_000 },
      );
      await this.activity.logActivity({
        userId: actor.id,
        entityType: 'stock_count',
        entityId: id,
        action: 'start_count',
        newValues: { items: items.length },
      });
      return this.get(id);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('Kho này đang có phiếu kiểm chưa hoàn tất');
      throw e;
    }
  }

  /** Sets or adds a counted quantity (by line or by scanned code) and records the system figure now. */
  async enter(actor: Actor, id: string, dto: CountEntryDto) {
    if (dto.quantity == null && dto.increment == null)
      throw new BadRequestException('Cần số lượng hoặc số cộng thêm');
    return this.prisma.$transaction(async (tx) => {
      const c = await this.open(tx, id);
      let line = dto.item_id
        ? await tx.stock_count_items.findFirst({
            where: { id: dto.item_id, stock_count_id: id },
          })
        : null;
      if (!line && dto.code) {
        const found = await this.codes.lookup(dto.code, tx);
        const item: StockItem = found.variant_id
          ? { productId: null, variantId: found.variant_id }
          : { productId: found.product_id, variantId: null };
        line = await tx.stock_count_items.findFirst({
          where: { stock_count_id: id, ...movementItem(item) },
        });
        if (!line) {
          // Scanned item outside the original scope: add it
          await ensureStockRow(tx, c.location_id, item);
          const s = await lockStock(tx, c.location_id, item);
          const info = await describeItems(tx, [item]);
          line = await tx.stock_count_items.create({
            data: {
              stock_count_id: id,
              ...movementItem(item),
              system_quantity: s.onHand,
              unit_cost: new Prisma.Decimal(info.get(keyOf(item)).cost),
            },
          });
        }
        dto = {
          ...dto,
          increment: (dto.increment ?? 1) * (found.unit_factor ?? 1),
        };
      }
      if (!line) throw new NotFoundException('Không tìm thấy dòng kiểm');
      const s = await lockStock(tx, c.location_id, itemOf(line));
      const counted =
        dto.quantity != null
          ? dto.quantity
          : (line.counted_quantity ?? 0) + (dto.increment ?? 0);
      return tx.stock_count_items.update({
        where: { id: line.id },
        data: {
          counted_quantity: counted,
          system_at_count: s.onHand,
          counted_at: new Date(),
          counted_by: actor.id,
        },
      });
    });
  }

  /** Posts counted − system-at-count for every counted item (D3). */
  async complete(actor: Actor, id: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const c = await this.open(tx, id);
        const lines = await tx.stock_count_items.findMany({
          where: { stock_count_id: id, counted_quantity: { not: null } },
        });
        for (const l of lines) {
          const adjustment =
            l.counted_quantity - (l.system_at_count ?? l.system_quantity);
          await tx.stock_count_items.update({
            where: { id: l.id },
            data: { adjustment },
          });
          if (!adjustment) continue;
          const s = await lockStock(tx, c.location_id, itemOf(l));
          if (s.onHand + adjustment < 0)
            throw new UnprocessableEntityException({
              code: 'COUNT_NEGATIVE',
              message: 'Điều chỉnh làm tồn kho âm; hãy kiểm lại mặt hàng này',
            });
          await tx.inventory_transactions.create({
            data: {
              location_id: c.location_id,
              ...movementItem(itemOf(l)),
              transaction_type: 'ADJUST',
              quantity: adjustment,
              unit_cost: l.unit_cost,
              total_cost: l.unit_cost
                ? new Prisma.Decimal(Number(l.unit_cost) * adjustment)
                : null,
              reference_type: 'stock_count',
              reference_id: id,
              reason_code: adjustment > 0 ? 'count_surplus' : 'count_shortage',
              created_by: actor.id,
            },
          });
        }
        await tx.stock_counts.update({
          where: { id },
          data: {
            status: 'completed',
            completed_by: actor.id,
            completed_at: new Date(),
          },
        });
      },
      { timeout: 60_000 },
    );
    await this.activity.logActivity({
      userId: actor.id,
      entityType: 'stock_count',
      entityId: id,
      action: 'complete_count',
      newValues: {},
    });
    return this.get(id);
  }

  async cancel(actor: Actor, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.open(tx, id);
      await tx.stock_counts.update({
        where: { id },
        data: {
          status: 'cancelled',
          completed_by: actor.id,
          completed_at: new Date(),
        },
      });
    });
    return this.get(id);
  }

  private async open(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM stock_counts WHERE id = ${id}::uuid FOR UPDATE`;
    const c = await tx.stock_counts.findFirst({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy phiếu kiểm kho');
    if (c.status !== 'counting')
      throw new ConflictException('Phiếu kiểm đã kết thúc');
    return c;
  }

  /** Items in scope: products with active variants are counted per variant. */
  private async scopeItems(dto: StartCountDto): Promise<StockItem[]> {
    const s = dto.scope;
    if (s.type === 'all') {
      const rows = await this.prisma.inventory.findMany({
        where: { location_id: dto.location_id },
        select: { product_id: true, product_variant_id: true },
      });
      return rows.map((r) =>
        r.product_variant_id
          ? { productId: null, variantId: r.product_variant_id }
          : { productId: r.product_id, variantId: null },
      );
    }
    const where: Prisma.productsWhereInput =
      s.type === 'category'
        ? { category_id: s.category_id }
        : s.type === 'brand'
          ? { brand_id: s.brand_id }
          : { id: { in: s.product_ids ?? [] } };
    // a product with size/colour products under it holds no stock itself
    const products = await this.prisma.products.findMany({
      where: { ...where, is_active: true, other_products: { none: {} } },
      select: {
        id: true,
        product_variants: { where: { is_active: true }, select: { id: true } },
      },
    });
    return products.flatMap((p) =>
      p.product_variants.length
        ? p.product_variants.map((v) => ({ productId: null, variantId: v.id }))
        : [{ productId: p.id, variantId: null }],
    );
  }
}

const itemOf = (i: {
  product_id: string | null;
  product_variant_id: string | null;
}): StockItem =>
  i.product_variant_id
    ? { productId: null, variantId: i.product_variant_id }
    : { productId: i.product_id, variantId: null };
