import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UnitDto } from './dto/stock-operations.dto';

type Db = Prisma.TransactionClient | PrismaService;

/** EAN-13 check digit for 12 digits. */
export function ean13CheckDigit(d12: string): number {
  const sum = d12
    .split('')
    .reduce((s, c, i) => s + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return (
    /^\d{13}$/.test(code) &&
    ean13CheckDigit(code.slice(0, 12)) === Number(code[12])
  );
}

export interface LookupResult {
  kind: 'product' | 'variant' | 'unit';
  product_id: string;
  variant_id: string | null;
  unit_id: string | null;
  unit_name: string | null;
  unit_factor: number;
  name: string;
  sku: string;
  barcode: string | null;
}

/** Barcodes on products, variants and units, and units of measure (design D5, D8). */
@Injectable()
export class CodesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Who already uses a barcode, across products, variants and units. */
  async owner(code: string, db: Db = this.prisma) {
    const [p, v, u] = await Promise.all([
      db.products.findFirst({ where: { barcode: code }, select: { id: true } }),
      db.product_variants.findFirst({
        where: { barcode: code },
        select: { id: true },
      }),
      db.product_units.findFirst({
        where: { barcode: code },
        select: { id: true },
      }),
    ]);
    return p
      ? { type: 'product', id: p.id }
      : v
        ? { type: 'variant', id: v.id }
        : u
          ? { type: 'unit', id: u.id }
          : null;
  }

  private async assertFree(
    code: string,
    self: { type: string; id: string } | null,
  ) {
    const o = await this.owner(code);
    if (o && !(self && o.type === self.type && o.id === self.id))
      throw new ConflictException(`Mã vạch ${code} đã được dùng`);
  }

  async setBarcode(
    type: 'product' | 'variant',
    id: string,
    barcode: string | null | undefined,
  ) {
    const code = barcode?.trim() || null;
    if (code) await this.assertFree(code, { type, id });
    if (type === 'product')
      await this.prisma.products.update({
        where: { id },
        data: { barcode: code },
      });
    else
      await this.prisma.product_variants.update({
        where: { id },
        data: { barcode: code },
      });
    return { id, barcode: code };
  }

  /** Internal EAN-13: "20" + 10-digit sequence + check digit, skipping codes already used. */
  async generate(type: 'product' | 'variant', id: string) {
    for (let i = 0; i < 20; i++) {
      const rows = await this.prisma.$queryRaw<
        { n: bigint }[]
      >`SELECT nextval('barcode_seq') AS n`;
      const d12 = `20${String(rows[0].n).padStart(10, '0')}`;
      const code = d12 + ean13CheckDigit(d12);
      if (!(await this.owner(code))) return this.setBarcode(type, id, code);
    }
    throw new ConflictException('Không tạo được mã vạch mới');
  }

  /** Barcode (exact) or SKU (case-insensitive) → product, variant or unit. */
  async lookup(raw: string, db: Db = this.prisma): Promise<LookupResult> {
    const code = raw.trim();
    if (!code) throw new BadRequestException('Chưa nhập mã');
    const [variant, unit, product] = await Promise.all([
      db.product_variants.findFirst({
        where: {
          OR: [
            { barcode: code },
            { sku: { equals: code, mode: 'insensitive' } },
          ],
        },
        include: { products: { select: { name: true } } },
      }),
      db.product_units.findFirst({
        where: { barcode: code, is_active: true },
        include: { products: { select: { id: true, name: true, sku: true } } },
      }),
      db.products.findFirst({
        where: {
          OR: [
            { barcode: code },
            { sku: { equals: code, mode: 'insensitive' } },
          ],
        },
      }),
    ]);
    if (variant)
      return {
        kind: 'variant',
        product_id: variant.product_id,
        variant_id: variant.id,
        unit_id: null,
        unit_name: null,
        unit_factor: 1,
        name: `${variant.products.name} / ${variant.name}`,
        sku: variant.sku,
        barcode: variant.barcode,
      };
    if (unit)
      return {
        kind: 'unit',
        product_id: unit.product_id,
        variant_id: null,
        unit_id: unit.id,
        unit_name: unit.name,
        unit_factor: unit.factor,
        name: `${unit.products.name} (${unit.name})`,
        sku: unit.products.sku,
        barcode: unit.barcode,
      };
    if (product)
      return {
        kind: 'product',
        product_id: product.id,
        variant_id: null,
        unit_id: null,
        unit_name: null,
        unit_factor: 1,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
      };
    throw new NotFoundException(`Không tìm thấy mã ${code}`);
  }

  // ---------- units ----------

  async units(productId: string) {
    const product = await this.prisma.products.findFirst({
      where: { id: productId },
      select: {
        id: true,
        base_unit: true,
        product_units: { orderBy: { factor: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return {
      base_unit: product.base_unit,
      units: product.product_units.map((u) => ({
        ...u,
        price: u.price == null ? null : Number(u.price),
      })),
    };
  }

  async setBaseUnit(productId: string, baseUnit: string) {
    await this.prisma.products.update({
      where: { id: productId },
      data: { base_unit: baseUnit },
    });
    return this.units(productId);
  }

  async addUnit(productId: string, dto: UnitDto) {
    if (dto.barcode) await this.assertFree(dto.barcode, null);
    try {
      await this.prisma.product_units.create({
        data: {
          product_id: productId,
          name: dto.name,
          factor: dto.factor,
          barcode: dto.barcode || null,
          price: dto.price == null ? null : new Prisma.Decimal(dto.price),
          is_active: dto.is_active ?? true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(`Đơn vị ${dto.name} đã có`);
      throw e;
    }
    return this.units(productId);
  }

  async updateUnit(productId: string, unitId: string, dto: Partial<UnitDto>) {
    if (dto.barcode)
      await this.assertFree(dto.barcode, { type: 'unit', id: unitId });
    const { count } = await this.prisma.product_units.updateMany({
      where: { id: unitId, product_id: productId },
      data: {
        name: dto.name,
        factor: dto.factor,
        barcode: dto.barcode === undefined ? undefined : dto.barcode || null,
        price:
          dto.price === undefined
            ? undefined
            : dto.price == null
              ? null
              : new Prisma.Decimal(dto.price),
        is_active: dto.is_active,
      },
    });
    if (!count) throw new NotFoundException('Không tìm thấy đơn vị');
    return this.units(productId);
  }

  async removeUnit(productId: string, unitId: string) {
    const used = await this.prisma.sales_order_items.count({
      where: {
        product_id: productId,
        unit_name: { not: null },
        unit_factor: { gt: 1 },
      },
    });
    if (used) {
      await this.prisma.product_units.updateMany({
        where: { id: unitId, product_id: productId },
        data: { is_active: false },
      });
    } else {
      await this.prisma.product_units.deleteMany({
        where: { id: unitId, product_id: productId },
      });
    }
    return this.units(productId);
  }
}
