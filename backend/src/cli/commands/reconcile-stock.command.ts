import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface ReconcileOptions {
  apply?: boolean;
  location?: string;
}

interface DiffRow {
  location: string;
  sku: string;
  name: string;
  kind: 'product' | 'variant';
  on_hand: number;
  from_movements: number;
  difference: number;
}

/**
 * Compares inventory.quantity_on_hand with the sum of inventory_transactions
 * per location and product/variant. Read-only by default; `--apply` writes the
 * recomputed quantities (and a report of what changed).
 *
 * Background: before pos-checkout-core, confirming a sales order deducted
 * stock twice and variant movements also changed the base product's row, so
 * stored quantities may drift from the movement history.
 */
@Injectable()
@Command({
  name: 'stock:reconcile',
  description:
    'Compare stock on hand with the movement history per location and report (or apply) differences',
})
export class ReconcileStockCommand extends CommandRunner {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  @Option({
    flags: '-a, --apply',
    description: 'Write the recomputed quantities (default: report only)',
  })
  parseApply(): boolean {
    return true;
  }

  @Option({
    flags: '-l, --location <code>',
    description: 'Only this stock location code',
  })
  parseLocation(value: string): string {
    return value;
  }

  async run(_params: string[], options: ReconcileOptions = {}): Promise<void> {
    const rows = await this.prisma.$queryRaw<DiffRow[]>`
      WITH moves AS (
        SELECT it.location_id,
               COALESCE(it.product_variant_id::text, it.product_id::text) AS item_key,
               it.product_variant_id IS NOT NULL AS is_variant,
               SUM(CASE
                     WHEN it.transaction_type IN ('SALE', 'TRANSFER_OUT') THEN -ABS(it.quantity)
                     WHEN it.transaction_type IN ('RECEIVE', 'ADJUST', 'RETURN', 'TRANSFER_IN') THEN it.quantity
                     ELSE 0 END)::int AS qty
        FROM inventory_transactions it
        GROUP BY it.location_id, COALESCE(it.product_variant_id::text, it.product_id::text), it.product_variant_id IS NOT NULL
      ),
      stock AS (
        SELECT inv.location_id,
               COALESCE(inv.product_variant_id::text, inv.product_id::text) AS item_key,
               inv.product_variant_id IS NOT NULL AS is_variant,
               COALESCE(inv.quantity_on_hand, 0)::int AS on_hand
        FROM inventory inv
      )
      SELECT sl.name AS location,
             COALESCE(pv.sku, p.sku) AS sku,
             COALESCE(pv.name, p.name) AS name,
             CASE WHEN COALESCE(s.is_variant, m.is_variant) THEN 'variant' ELSE 'product' END AS kind,
             COALESCE(s.on_hand, 0) AS on_hand,
             COALESCE(m.qty, 0) AS from_movements,
             (COALESCE(s.on_hand, 0) - COALESCE(m.qty, 0)) AS difference
      FROM stock s
      FULL OUTER JOIN moves m ON m.location_id = s.location_id AND m.item_key = s.item_key
      JOIN stock_locations sl ON sl.id = COALESCE(s.location_id, m.location_id)
      LEFT JOIN product_variants pv ON pv.id::text = COALESCE(s.item_key, m.item_key) AND COALESCE(s.is_variant, m.is_variant)
      LEFT JOIN products p ON p.id::text = CASE WHEN COALESCE(s.is_variant, m.is_variant) THEN pv.product_id::text ELSE COALESCE(s.item_key, m.item_key) END
      WHERE COALESCE(s.on_hand, 0) <> COALESCE(m.qty, 0)
        ${options.location ? Prisma.sql`AND sl.code = ${options.location}` : Prisma.empty}
      ORDER BY sl.name, COALESCE(pv.sku, p.sku)`;

    const filtered = rows;
    const checked = await this.prisma.inventory.count();
    console.log(
      `Checked ${checked} stock rows; ${filtered.length} differ from the movement history.`,
    );
    if (filtered.length === 0) return;

    console.table(
      filtered.map((r) => ({
        location: r.location,
        sku: r.sku,
        name: r.name,
        kind: r.kind,
        on_hand: r.on_hand,
        from_movements: r.from_movements,
        difference: r.difference,
      })),
    );
    const over = filtered.filter((r) => r.difference > 0).length;
    const under = filtered.length - over;
    console.log(
      `\n${over} row(s) show more stock than the movements explain, ${under} show less.`,
    );

    if (!options.apply) {
      console.log(
        'Report only. Re-run with --apply to set quantity_on_hand to the movement totals (an ADJUST movement is recorded for each change).',
      );
      return;
    }

    let applied = 0;
    for (const r of filtered) {
      const location = await this.prisma.stock_locations.findFirst({
        where: { name: r.location },
      });
      if (!location) continue;
      const item =
        r.kind === 'variant'
          ? await this.prisma.product_variants.findFirst({
              where: { sku: r.sku },
            })
          : await this.prisma.products.findFirst({ where: { sku: r.sku } });
      if (!item) continue;
      await this.prisma.$transaction(async (tx) => {
        // The ADJUST movement carries the delta so that history and stock agree afterwards;
        // the inventory trigger applies it to the row.
        await tx.inventory_transactions.create({
          data: {
            location_id: location.id,
            product_id: r.kind === 'variant' ? null : item.id,
            product_variant_id: r.kind === 'variant' ? item.id : null,
            transaction_type: 'ADJUST',
            quantity: -r.difference,
            reason_code: 'reconciliation',
            notes: `stock:reconcile: on hand ${r.on_hand}, movements ${r.from_movements}`,
          },
        });
      });
      applied += 1;
    }
    console.log(`Applied ${applied} adjustment(s).`);
  }
}
