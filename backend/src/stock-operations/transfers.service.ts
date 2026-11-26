import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  assertAvailable,
  ensureStockRow,
  nextDocumentNumber,
} from '../inventory/stock-helpers';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTransferDto,
  ReceiveTransferDto,
  ShipTransferDto,
  TransferQueryDto,
} from './dto/stock-operations.dto';
import { describeItems, keyOf, movementItem, stockItemOf } from './item-names';

type Tx = Prisma.TransactionClient;
interface Actor {
  id: string;
}

const include = {
  transfer_order_items: { orderBy: { created_at: 'asc' } },
  stock_locations_transfer_orders_from_location_idTostock_locations: {
    select: { id: true, name: true, code: true },
  },
  stock_locations_transfer_orders_to_location_idTostock_locations: {
    select: { id: true, name: true, code: true },
  },
  user_profiles_transfer_orders_requested_byTouser_profiles: {
    select: { full_name: true },
  },
  user_profiles_transfer_orders_shipped_byTouser_profiles: {
    select: { full_name: true },
  },
  user_profiles_transfer_orders_received_byTouser_profiles: {
    select: { full_name: true },
  },
} satisfies Prisma.transfer_ordersInclude;

/** Stock transfers between locations (spec inventory/stock-transfers, design D2). */
@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogsService,
  ) {}

  async list(q: TransferQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const where: Prisma.transfer_ordersWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.locationId
        ? {
            OR: [
              { from_location_id: q.locationId },
              { to_location_id: q.locationId },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.transfer_orders.findMany({
        where,
        include,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transfer_orders.count({ where }),
    ]);
    return {
      data: rows.map((r) => this.shapeSummary(r)),
      pagination: { page, pageSize, total },
    };
  }

  async get(id: string, db: Tx | PrismaService = this.prisma) {
    const t = await db.transfer_orders.findFirst({ where: { id }, include });
    if (!t) throw new NotFoundException('Không tìm thấy phiếu chuyển kho');
    const info = await describeItems(
      db as Tx,
      t.transfer_order_items.map(stockItemOf),
    );
    return {
      ...this.shapeSummary(t),
      items: t.transfer_order_items.map((i) => {
        const d = info.get(keyOf(stockItemOf(i)));
        return {
          id: i.id,
          product_id: i.product_id,
          product_variant_id: i.product_variant_id,
          name: d.name,
          sku: d.sku,
          barcode: d.barcode,
          price: d.price,
          quantity_requested: i.quantity_requested,
          quantity_shipped: i.quantity_shipped ?? 0,
          quantity_received: i.quantity_received ?? 0,
          quantity_discrepancy: i.quantity_discrepancy,
          unit_cost: i.unit_cost == null ? null : Number(i.unit_cost),
        };
      }),
    };
  }

  async create(actor: Actor, dto: CreateTransferDto) {
    if (dto.from_location_id === dto.to_location_id)
      throw new BadRequestException('Kho đi và kho đến phải khác nhau');
    // Same item on several lines → one line
    const merged = new Map<
      string,
      { product_id?: string; product_variant_id?: string; quantity: number }
    >();
    for (const l of dto.items) {
      const item = stockItemOf(l);
      const k = keyOf(item);
      merged.set(k, {
        product_id: item.productId ?? undefined,
        product_variant_id: item.variantId ?? undefined,
        quantity: (merged.get(k)?.quantity ?? 0) + l.quantity,
      });
    }
    const id = await this.prisma.$transaction(async (tx) => {
      await describeItems(tx, [...merged.values()].map(stockItemOf));
      const t = await tx.transfer_orders.create({
        data: {
          transfer_number: await nextDocumentNumber(tx, 'CK'),
          from_location_id: dto.from_location_id,
          to_location_id: dto.to_location_id,
          status: 'pending',
          requested_by: actor.id,
          requested_date: new Date(),
          notes: dto.notes,
          transfer_order_items: {
            create: [...merged.values()].map((l) => ({
              product_id: l.product_id ?? null,
              product_variant_id: l.product_variant_id ?? null,
              quantity_requested: l.quantity,
            })),
          },
        },
      });
      return t.id;
    });
    await this.log(actor, id, 'create_transfer');
    return this.get(id);
  }

  /** pending → in_transit: stock leaves the source (available stock only). */
  async ship(actor: Actor, id: string, dto: ShipTransferDto) {
    await this.prisma.$transaction(async (tx) => {
      const t = await this.lock(tx, id);
      if (t.status !== 'pending')
        throw new ConflictException('Chỉ phiếu đang chờ mới được xuất');
      const info = await describeItems(
        tx,
        t.transfer_order_items.map(stockItemOf),
      );
      const qty = new Map(dto.items?.map((i) => [i.item_id, i.quantity]));
      const lines = t.transfer_order_items.map((i) => ({
        item: i,
        stock: stockItemOf(i),
        quantity: qty.get(i.id) ?? i.quantity_requested,
      }));
      if (lines.some((l) => l.quantity > l.item.quantity_requested))
        throw new BadRequestException('Số xuất không được vượt số yêu cầu');
      if (lines.every((l) => l.quantity === 0))
        throw new BadRequestException('Chưa xuất mặt hàng nào');
      const shipping = lines.filter((l) => l.quantity > 0);
      await assertAvailable(
        tx,
        t.from_location_id,
        shipping.map((l) => ({
          ...l.stock,
          quantity: l.quantity,
          name: info.get(keyOf(l.stock)).name,
          sku: info.get(keyOf(l.stock)).sku,
        })),
      );
      for (const l of lines) {
        const cost = info.get(keyOf(l.stock)).cost;
        await tx.transfer_order_items.update({
          where: { id: l.item.id },
          data: {
            quantity_shipped: l.quantity,
            unit_cost: new Prisma.Decimal(cost),
            updated_at: new Date(),
          },
        });
        if (l.quantity > 0)
          await tx.inventory_transactions.create({
            data: {
              location_id: t.from_location_id,
              ...movementItem(l.stock),
              transaction_type: 'TRANSFER_OUT',
              quantity: -l.quantity,
              unit_cost: new Prisma.Decimal(cost),
              total_cost: new Prisma.Decimal(cost * l.quantity),
              reference_type: 'transfer_order',
              reference_id: id,
              created_by: actor.id,
            },
          });
      }
      await tx.transfer_orders.update({
        where: { id },
        data: {
          status: 'in_transit',
          shipped_by: actor.id,
          shipped_date: new Date(),
          updated_at: new Date(),
        },
      });
    });
    await this.log(actor, id, 'ship_transfer');
    return this.get(id);
  }

  /** Receives quantities (cumulative ≤ shipped); closing records the rest as a discrepancy. */
  async receive(actor: Actor, id: string, dto: ReceiveTransferDto) {
    await this.prisma.$transaction(async (tx) => {
      const t = await this.lock(tx, id);
      if (t.status !== 'in_transit' && t.status !== 'partially_received')
        throw new ConflictException('Phiếu chưa xuất hoặc đã nhận xong');
      const qty = new Map(dto.items.map((i) => [i.item_id, i.quantity]));
      for (const k of qty.keys())
        if (!t.transfer_order_items.some((i) => i.id === k))
          throw new BadRequestException('Dòng hàng không thuộc phiếu');
      let allIn = true;
      for (const i of t.transfer_order_items) {
        const add = qty.get(i.id) ?? 0;
        const received = (i.quantity_received ?? 0) + add;
        const shipped = i.quantity_shipped ?? 0;
        if (received > shipped)
          throw new BadRequestException('Số nhận vượt số đã xuất');
        const stock = stockItemOf(i);
        if (add > 0) {
          await ensureStockRow(tx, t.to_location_id, stock);
          await tx.inventory_transactions.create({
            data: {
              location_id: t.to_location_id,
              ...movementItem(stock),
              transaction_type: 'TRANSFER_IN',
              quantity: add,
              unit_cost: i.unit_cost,
              total_cost: i.unit_cost
                ? new Prisma.Decimal(Number(i.unit_cost) * add)
                : null,
              reference_type: 'transfer_order',
              reference_id: id,
              created_by: actor.id,
            },
          });
        }
        const missing = shipped - received;
        if (missing > 0) allIn = false;
        const closing = dto.close && missing > 0;
        await tx.transfer_order_items.update({
          where: { id: i.id },
          data: {
            quantity_received: received,
            quantity_discrepancy: closing ? missing : 0,
            updated_at: new Date(),
          },
        });
        if (closing)
          await tx.inventory_transactions.create({
            data: {
              location_id: t.to_location_id,
              ...movementItem(stock),
              transaction_type: 'TRANSFER_LOSS',
              quantity: missing,
              unit_cost: i.unit_cost,
              total_cost: i.unit_cost
                ? new Prisma.Decimal(Number(i.unit_cost) * missing)
                : null,
              reference_type: 'transfer_order',
              reference_id: id,
              notes: 'Thiếu khi nhận chuyển kho',
              created_by: actor.id,
            },
          });
      }
      const done = allIn || !!dto.close;
      await tx.transfer_orders.update({
        where: { id },
        data: {
          status: done ? 'received' : 'partially_received',
          received_by: actor.id,
          received_date: done ? new Date() : t.received_date,
          updated_at: new Date(),
        },
      });
    });
    await this.log(actor, id, 'receive_transfer');
    return this.get(id);
  }

  /** Pending: no stock effect. In transit: unreceived units go back to the source. */
  async cancel(actor: Actor, id: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const t = await this.lock(tx, id);
      if (t.status === 'received' || t.status === 'cancelled')
        throw new ConflictException('Phiếu đã kết thúc');
      if (t.status !== 'pending') {
        for (const i of t.transfer_order_items) {
          const back = (i.quantity_shipped ?? 0) - (i.quantity_received ?? 0);
          if (back <= 0) continue;
          const stock = stockItemOf(i);
          await ensureStockRow(tx, t.from_location_id, stock);
          await tx.inventory_transactions.create({
            data: {
              location_id: t.from_location_id,
              ...movementItem(stock),
              transaction_type: 'TRANSFER_IN',
              quantity: back,
              unit_cost: i.unit_cost,
              reference_type: 'transfer_order',
              reference_id: id,
              notes: 'Hủy chuyển kho, trả về kho đi',
              created_by: actor.id,
            },
          });
        }
      }
      await tx.transfer_orders.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelled_at: new Date(),
          cancelled_by: actor.id,
          cancel_reason: reason,
          updated_at: new Date(),
        },
      });
    });
    await this.log(actor, id, 'cancel_transfer', { reason });
    return this.get(id);
  }

  private async lock(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM transfer_orders WHERE id = ${id}::uuid FOR UPDATE`;
    const t = await tx.transfer_orders.findFirst({
      where: { id },
      include: { transfer_order_items: true },
    });
    if (!t) throw new NotFoundException('Không tìm thấy phiếu chuyển kho');
    return t;
  }

  private shapeSummary(
    t: Prisma.transfer_ordersGetPayload<{ include: typeof include }>,
  ) {
    return {
      id: t.id,
      transfer_number: t.transfer_number,
      status: t.status,
      from: t.stock_locations_transfer_orders_from_location_idTostock_locations,
      to: t.stock_locations_transfer_orders_to_location_idTostock_locations,
      notes: t.notes,
      requested_date: t.requested_date,
      shipped_date: t.shipped_date,
      received_date: t.received_date,
      cancelled_at: t.cancelled_at,
      cancel_reason: t.cancel_reason,
      requested_by:
        t.user_profiles_transfer_orders_requested_byTouser_profiles
          ?.full_name ?? null,
      shipped_by:
        t.user_profiles_transfer_orders_shipped_byTouser_profiles?.full_name ??
        null,
      received_by:
        t.user_profiles_transfer_orders_received_byTouser_profiles?.full_name ??
        null,
      created_at: t.created_at,
      line_count: t.transfer_order_items.length,
      quantity_requested: t.transfer_order_items.reduce(
        (s, i) => s + i.quantity_requested,
        0,
      ),
      quantity_shipped: t.transfer_order_items.reduce(
        (s, i) => s + (i.quantity_shipped ?? 0),
        0,
      ),
      quantity_received: t.transfer_order_items.reduce(
        (s, i) => s + (i.quantity_received ?? 0),
        0,
      ),
      quantity_discrepancy: t.transfer_order_items.reduce(
        (s, i) => s + i.quantity_discrepancy,
        0,
      ),
    };
  }

  private log(
    actor: Actor,
    id: string,
    action: string,
    values: Record<string, unknown> = {},
  ) {
    return this.activity.logActivity({
      userId: actor.id,
      entityType: 'transfer_order',
      entityId: id,
      action,
      newValues: values,
    });
  }
}
