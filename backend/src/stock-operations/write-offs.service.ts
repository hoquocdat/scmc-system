import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  assertAvailable,
  nextDocumentNumber,
} from '../inventory/stock-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { ReportScope } from '../reports/report-scope';
import { col, ReportResult } from '../reports/report-types';
import {
  CreateWriteOffDto,
  WriteOffQueryDto,
} from './dto/stock-operations.dto';
import { describeItems, keyOf, movementItem, stockItemOf } from './item-names';

interface Actor {
  id: string;
}

export const WRITE_OFF_REASON_LABELS: Record<string, string> = {
  damaged: 'Hư hỏng',
  lost: 'Mất',
  internal_use: 'Dùng nội bộ',
  expired: 'Hết hạn',
  other: 'Khác',
};

/** Write-offs (xuất hủy) — spec inventory/write-offs, design D4. */
@Injectable()
export class WriteOffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogsService,
  ) {}

  async create(actor: Actor, dto: CreateWriteOffDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      const items = dto.items.map((l) => ({
        stock: stockItemOf(l),
        quantity: l.quantity,
      }));
      const info = await describeItems(
        tx,
        items.map((i) => i.stock),
      );
      await assertAvailable(
        tx,
        dto.location_id,
        items.map((i) => ({
          ...i.stock,
          quantity: i.quantity,
          name: info.get(keyOf(i.stock)).name,
          sku: info.get(keyOf(i.stock)).sku,
        })),
      );
      const total = items.reduce(
        (s, i) => s + info.get(keyOf(i.stock)).cost * i.quantity,
        0,
      );
      const w = await tx.stock_write_offs.create({
        data: {
          write_off_number: await nextDocumentNumber(tx, 'XH'),
          location_id: dto.location_id,
          reason: dto.reason,
          note: dto.note,
          total_cost: new Prisma.Decimal(total),
          created_by: actor.id,
          stock_write_off_items: {
            create: items.map((i) => ({
              ...movementItem(i.stock),
              quantity: i.quantity,
              unit_cost: new Prisma.Decimal(info.get(keyOf(i.stock)).cost),
            })),
          },
        },
      });
      for (const i of items) {
        const cost = info.get(keyOf(i.stock)).cost;
        await tx.inventory_transactions.create({
          data: {
            location_id: dto.location_id,
            ...movementItem(i.stock),
            transaction_type: 'WRITE_OFF',
            quantity: -i.quantity,
            unit_cost: new Prisma.Decimal(cost),
            total_cost: new Prisma.Decimal(cost * i.quantity),
            reference_type: 'stock_write_off',
            reference_id: w.id,
            reason_code: dto.reason,
            notes: dto.note,
            created_by: actor.id,
          },
        });
      }
      return w.id;
    });
    await this.activity.logActivity({
      userId: actor.id,
      entityType: 'stock_write_off',
      entityId: id,
      action: 'create_write_off',
      newValues: { reason: dto.reason, lines: dto.items.length },
    });
    return this.get(id);
  }

  async get(id: string) {
    const w = await this.prisma.stock_write_offs.findFirst({
      where: { id },
      include: {
        stock_write_off_items: true,
        stock_locations: { select: { id: true, name: true } },
        user_profiles: { select: { full_name: true } },
      },
    });
    if (!w) throw new NotFoundException('Không tìm thấy phiếu xuất hủy');
    const info = await describeItems(
      this.prisma as unknown as Prisma.TransactionClient,
      w.stock_write_off_items.map(stockItemOf),
    );
    return {
      ...w,
      total_cost: Number(w.total_cost),
      reason_label: WRITE_OFF_REASON_LABELS[w.reason],
      stock_write_off_items: w.stock_write_off_items.map((i) => ({
        ...i,
        unit_cost: Number(i.unit_cost ?? 0),
        name: info.get(keyOf(stockItemOf(i))).name,
        sku: info.get(keyOf(stockItemOf(i))).sku,
      })),
    };
  }

  /** Report envelope (export key inventory.write-offs). */
  async list(q: WriteOffQueryDto): Promise<ReportResult> {
    const scope = new ReportScope({ from: q.from, to: q.to });
    const rows = await this.prisma.stock_write_offs.findMany({
      where: {
        created_at: { gte: scope.start, lt: scope.endExclusive },
        ...(q.locationId ? { location_id: q.locationId } : {}),
        ...(q.reason ? { reason: q.reason } : {}),
      },
      include: {
        stock_locations: { select: { name: true } },
        user_profiles: { select: { full_name: true } },
        _count: { select: { stock_write_off_items: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 2000,
    });
    return {
      report: 'inventory.write-offs',
      title: { vi: 'Xuất hủy', en: 'Write-offs' },
      scope: scope.toJSON(),
      columns: [
        col('createdAt', 'Thời gian', 'Date', 'datetime'),
        col('number', 'Số phiếu', 'Number'),
        col('location', 'Kho', 'Location'),
        col('reason', 'Lý do', 'Reason'),
        col('lines', 'Số dòng', 'Lines', 'integer'),
        col('totalCost', 'Giá vốn', 'Cost', 'money'),
        col('note', 'Ghi chú', 'Note'),
        col('createdBy', 'Người lập', 'Created by'),
      ],
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at.toISOString(),
        number: r.write_off_number,
        location: r.stock_locations.name,
        reason: WRITE_OFF_REASON_LABELS[r.reason],
        lines: r._count.stock_write_off_items,
        totalCost: Number(r.total_cost),
        note: r.note ?? '',
        createdBy: r.user_profiles?.full_name ?? '',
      })),
      totals: { totalCost: rows.reduce((s, r) => s + Number(r.total_cost), 0) },
    };
  }
}
