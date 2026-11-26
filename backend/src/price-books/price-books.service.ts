import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { applyEntry } from '../sales/pricing/price-book-rule';
import { resolvePrice } from '../sales/pricing/price-resolver';
import { duplicate } from './customer-groups.service';
import {
  BulkAddEntriesDto,
  CreatePriceBookDto,
  EntryQueryDto,
  EntryRuleDto,
  PRICE_BOOK_MODES,
  PriceBookModeDto,
  UpdatePriceBookDto,
  UpsertEntryDto,
} from './dto/price-books.dto';

type Tx = Prisma.TransactionClient;
const MAX_IMPORT_ROWS = 5000;

const MODE_LABELS: Record<PriceBookModeDto, string> = {
  fixed: 'Giá cố định',
  percent_off: 'Giảm %',
  amount_off: 'Giảm tiền',
};

/** Accepts the code or the Vietnamese label of a mode, any case. */
export function parseMode(
  raw: string | null | undefined,
): PriceBookModeDto | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  for (const m of PRICE_BOOK_MODES) {
    if (s === m || s === MODE_LABELS[m].toLowerCase()) return m;
  }
  return null;
}

function checkRule(rule: EntryRuleDto) {
  if (rule.mode === 'percent_off' && rule.value > 100)
    throw new BadRequestException('Phần trăm giảm phải từ 0 đến 100');
  if (rule.value < 0) throw new BadRequestException('Giá trị không được âm');
}

function checkDates(start?: Date | null, end?: Date | null) {
  if (start && end && end < start)
    throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
}

const toDate = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : new Date(v);

const bookInclude = {
  price_book_stores: {
    include: { stores: { select: { id: true, name: true } } },
  },
  price_book_customer_groups: {
    include: {
      customer_groups: { select: { id: true, name: true, is_active: true } },
    },
  },
  _count: { select: { price_book_entries: true } },
} as const;

type BookRow = Prisma.price_booksGetPayload<{ include: typeof bookInclude }>;

const shapeBook = ({
  _count,
  price_book_stores,
  price_book_customer_groups,
  ...b
}: BookRow) => ({
  ...b,
  stores: price_book_stores.map((s) => s.stores),
  groups: price_book_customer_groups.map((g) => g.customer_groups),
  entry_count: _count.price_book_entries,
});

/** Price books and their entries (spec pricing/price-books). */
@Injectable()
export class PriceBooksService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- books ----------

  async list() {
    const rows = await this.prisma.price_books.findMany({
      include: bookInclude,
      orderBy: [{ is_active: 'desc' }, { priority: 'desc' }, { code: 'asc' }],
    });
    const books = rows.map(shapeBook);
    // Warn when two active books share a priority (design: risks)
    const byPriority = new Map<number, number>();
    for (const b of books)
      if (b.is_active)
        byPriority.set(b.priority, (byPriority.get(b.priority) ?? 0) + 1);
    return books.map((b) => ({
      ...b,
      shares_priority: b.is_active && (byPriority.get(b.priority) ?? 0) > 1,
    }));
  }

  async get(id: string) {
    const row = await this.prisma.price_books.findFirst({
      where: { id },
      include: bookInclude,
    });
    if (!row) throw new NotFoundException('Không tìm thấy bảng giá');
    return shapeBook(row);
  }

  async create(actorId: string, dto: CreatePriceBookDto) {
    const start = toDate(dto.start_at);
    const end = toDate(dto.end_at);
    checkDates(start, end);
    const stores = dto.store_ids ?? [];
    const groups = dto.group_ids ?? [];
    try {
      const book = await this.prisma.price_books.create({
        data: {
          code: dto.code,
          name: dto.name,
          priority: dto.priority ?? 0,
          is_active: dto.is_active ?? true,
          start_at: start,
          end_at: end,
          all_stores: stores.length === 0,
          all_customers: groups.length === 0,
          allow_manual: dto.allow_manual ?? false,
          notes: dto.notes,
          created_by: actorId,
          updated_by: actorId,
          price_book_stores: {
            create: stores.map((store_id) => ({ store_id })),
          },
          price_book_customer_groups: {
            create: groups.map((group_id) => ({ group_id })),
          },
        },
      });
      return this.get(book.id);
    } catch (e) {
      throw duplicate(e, `Mã bảng giá ${dto.code} đã tồn tại`);
    }
  }

  async update(actorId: string, id: string, dto: UpdatePriceBookDto) {
    const current = await this.get(id);
    const start =
      dto.start_at === undefined ? current.start_at : toDate(dto.start_at);
    const end = dto.end_at === undefined ? current.end_at : toDate(dto.end_at);
    checkDates(start, end);
    await this.prisma.$transaction(async (tx) => {
      await tx.price_books.update({
        where: { id },
        data: {
          name: dto.name,
          priority: dto.priority,
          is_active: dto.is_active,
          start_at: start,
          end_at: end,
          allow_manual: dto.allow_manual,
          notes: dto.notes,
          updated_by: actorId,
          updated_at: new Date(),
          ...(dto.store_ids ? { all_stores: dto.store_ids.length === 0 } : {}),
          ...(dto.group_ids
            ? { all_customers: dto.group_ids.length === 0 }
            : {}),
        },
      });
      if (dto.store_ids) {
        await tx.price_book_stores.deleteMany({ where: { price_book_id: id } });
        await tx.price_book_stores.createMany({
          data: dto.store_ids.map((store_id) => ({
            price_book_id: id,
            store_id,
          })),
        });
      }
      if (dto.group_ids) {
        await tx.price_book_customer_groups.deleteMany({
          where: { price_book_id: id },
        });
        await tx.price_book_customer_groups.createMany({
          data: dto.group_ids.map((group_id) => ({
            price_book_id: id,
            group_id,
          })),
        });
      }
    });
    return this.get(id);
  }

  /** Sold lines keep their price; their price_book_id becomes null. */
  async remove(id: string) {
    await this.get(id);
    await this.prisma.price_books.delete({ where: { id } });
    return { id };
  }

  // ---------- entries ----------

  async entries(id: string, q: EntryQueryDto) {
    await this.get(id);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const search = q.search?.trim();
    const where: Prisma.price_book_entriesWhereInput = {
      price_book_id: id,
      ...(search
        ? {
            OR: [
              { products: { name: { contains: search, mode: 'insensitive' } } },
              { products: { sku: { contains: search, mode: 'insensitive' } } },
              {
                product_variants: {
                  sku: { contains: search, mode: 'insensitive' },
                },
              },
              {
                product_variants: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.price_book_entries.findMany({
        where,
        include: { products: true, product_variants: true },
        orderBy: [{ products: { name: 'asc' } }, { created_at: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.price_book_entries.count({ where }),
    ]);
    const now = new Date();
    return {
      data: rows.map((e) => {
        const base = resolvePrice(
          e.products,
          e.product_variants,
          now,
        ).unitPrice;
        const value = Number(e.value);
        return {
          id: e.id,
          product_id: e.product_id,
          product_variant_id: e.product_variant_id,
          product_name: e.products.name,
          sku: e.product_variants?.sku ?? e.products.sku,
          variant_name: e.product_variants?.name ?? null,
          mode: e.mode,
          value,
          base_price: base,
          price: applyEntry(base, {
            product_id: e.product_id,
            product_variant_id: e.product_variant_id,
            mode: e.mode as PriceBookModeDto,
            value,
          }),
        };
      }),
      pagination: { page, pageSize, total },
    };
  }

  async upsertEntry(id: string, dto: UpsertEntryDto) {
    await this.get(id);
    checkRule(dto);
    return this.prisma.$transaction((tx) => this.upsert(tx, id, dto));
  }

  async updateEntry(id: string, entryId: string, dto: EntryRuleDto) {
    checkRule(dto);
    const entry = await this.prisma.price_book_entries.findFirst({
      where: { id: entryId, price_book_id: id },
    });
    if (!entry) throw new NotFoundException('Không tìm thấy dòng bảng giá');
    return this.prisma.price_book_entries.update({
      where: { id: entryId },
      data: {
        mode: dto.mode,
        value: new Prisma.Decimal(dto.value),
        updated_at: new Date(),
      },
    });
  }

  async removeEntry(id: string, entryId: string) {
    const { count } = await this.prisma.price_book_entries.deleteMany({
      where: { id: entryId, price_book_id: id },
    });
    if (!count) throw new NotFoundException('Không tìm thấy dòng bảng giá');
    return { id: entryId };
  }

  /** Adds product-level entries; products already in the book keep their entry. */
  async bulkAdd(id: string, dto: BulkAddEntriesDto) {
    await this.get(id);
    checkRule(dto);
    if (!dto.product_ids?.length && !dto.category_id && !dto.brand_id)
      throw new BadRequestException('Chọn sản phẩm, danh mục hoặc thương hiệu');
    const or: Prisma.productsWhereInput[] = [];
    if (dto.product_ids?.length) or.push({ id: { in: dto.product_ids } });
    if (dto.category_id) or.push({ category_id: dto.category_id });
    if (dto.brand_id) or.push({ brand_id: dto.brand_id });
    const products = await this.prisma.products.findMany({
      where: { OR: or, is_active: true },
      select: { id: true },
    });
    const existing = new Set(
      (
        await this.prisma.price_book_entries.findMany({
          where: { price_book_id: id, product_variant_id: null },
          select: { product_id: true },
        })
      ).map((e) => e.product_id),
    );
    const toAdd = products.filter((p) => !existing.has(p.id));
    await this.prisma.price_book_entries.createMany({
      data: toAdd.map((p) => ({
        price_book_id: id,
        product_id: p.id,
        mode: dto.mode,
        value: new Prisma.Decimal(dto.value),
      })),
      skipDuplicates: true,
    });
    return { created: toAdd.length, skipped: products.length - toAdd.length };
  }

  private async upsert(tx: Tx, id: string, dto: UpsertEntryDto) {
    if (dto.product_variant_id) {
      const variant = await tx.product_variants.findFirst({
        where: { id: dto.product_variant_id },
        select: { product_id: true },
      });
      if (!variant || variant.product_id !== dto.product_id)
        throw new BadRequestException('Biến thể không thuộc sản phẩm');
    }
    const existing = await tx.price_book_entries.findFirst({
      where: {
        price_book_id: id,
        product_id: dto.product_id,
        product_variant_id: dto.product_variant_id ?? null,
      },
    });
    const data = { mode: dto.mode, value: new Prisma.Decimal(dto.value) };
    return existing
      ? tx.price_book_entries.update({
          where: { id: existing.id },
          data: { ...data, updated_at: new Date() },
        })
      : tx.price_book_entries.create({
          data: {
            ...data,
            price_book_id: id,
            product_id: dto.product_id,
            product_variant_id: dto.product_variant_id ?? null,
          },
        });
  }

  // ---------- xlsx ----------

  async exportXlsx(id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const book = await this.get(id);
    const rows = await this.prisma.price_book_entries.findMany({
      where: { price_book_id: id },
      include: { products: true, product_variants: true },
      orderBy: [{ products: { sku: 'asc' } }],
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bang gia');
    ws.columns = [
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Variant SKU', key: 'variant', width: 18 },
      { header: 'Tên hàng', key: 'name', width: 40 },
      { header: 'Mode', key: 'mode', width: 14 },
      { header: 'Value', key: 'value', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const e of rows) {
      ws.addRow({
        sku: e.products.sku,
        variant: e.product_variants?.sku ?? '',
        name: e.product_variants
          ? `${e.products.name} - ${e.product_variants.name}`
          : e.products.name,
        mode: e.mode,
        value: Number(e.value),
      });
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, fileName: `bang-gia-${book.code}.xlsx` };
  }

  /**
   * Upserts every row or none (spec: import and export). Columns by header:
   * SKU, Variant SKU (optional), Mode, Value.
   */
  async importXlsx(id: string, file: Buffer) {
    await this.get(id);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Không đọc được tệp xlsx');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Tệp không có trang tính');
    const header = new Map<string, number>();
    ws.getRow(1).eachCell((cell, col) =>
      header.set(String(cell.text).trim().toLowerCase(), col),
    );
    const col = (...names: string[]) =>
      names.map((n) => header.get(n)).find((c) => c);
    const skuCol = col('sku', 'mã hàng');
    const variantCol = col('variant sku', 'mã biến thể');
    const modeCol = col('mode', 'cách tính');
    const valueCol = col('value', 'giá trị');
    if (!skuCol || !modeCol || !valueCol)
      throw new BadRequestException('Thiếu cột SKU, Mode hoặc Value');

    type Raw = {
      row: number;
      sku: string;
      variantSku: string;
      mode: string;
      value: unknown;
    };
    const raws: Raw[] = [];
    ws.eachRow((r, n) => {
      if (n === 1) return;
      const sku = String(r.getCell(skuCol).text ?? '').trim();
      const variantSku = variantCol
        ? String(r.getCell(variantCol).text ?? '').trim()
        : '';
      if (!sku && !variantSku) return;
      raws.push({
        row: n,
        sku,
        variantSku,
        mode: r.getCell(modeCol).text,
        value: r.getCell(valueCol).value,
      });
    });
    if (raws.length > MAX_IMPORT_ROWS)
      throw new BadRequestException(`Tối đa ${MAX_IMPORT_ROWS} dòng mỗi tệp`);

    const products = await this.prisma.products.findMany({
      where: { sku: { in: [...new Set(raws.map((r) => r.sku))] } },
      select: { id: true, sku: true },
    });
    const variants = await this.prisma.product_variants.findMany({
      where: {
        sku: {
          in: [...new Set(raws.map((r) => r.variantSku).filter(Boolean))],
        },
      },
      select: { id: true, sku: true, product_id: true },
    });
    const productBySku = new Map(products.map((p) => [p.sku, p]));
    const variantBySku = new Map(variants.map((v) => [v.sku, v]));

    const errors: { row: number; message: string }[] = [];
    const valid: UpsertEntryDto[] = [];
    const seen = new Set<string>();
    for (const r of raws) {
      const product = productBySku.get(r.sku);
      const variant = r.variantSku ? variantBySku.get(r.variantSku) : undefined;
      const mode = parseMode(r.mode);
      const value = Number(
        typeof r.value === 'object' && r.value
          ? (r.value as { result?: unknown }).result
          : r.value,
      );
      const fail = (message: string) => errors.push({ row: r.row, message });
      if (!product) {
        fail(`Không tìm thấy SKU "${r.sku}"`);
        continue;
      }
      if (r.variantSku && !variant) {
        fail(`Không tìm thấy biến thể "${r.variantSku}"`);
        continue;
      }
      if (variant && variant.product_id !== product.id) {
        fail(`Biến thể "${r.variantSku}" không thuộc "${r.sku}"`);
        continue;
      }
      if (!mode) {
        fail(`Cách tính "${r.mode}" không hợp lệ`);
        continue;
      }
      if (!Number.isFinite(value) || value < 0) {
        fail('Giá trị phải là số không âm');
        continue;
      }
      if (mode === 'percent_off' && value > 100) {
        fail('Phần trăm giảm phải từ 0 đến 100');
        continue;
      }
      const key = `${product.id}:${variant?.id ?? ''}`;
      if (seen.has(key)) {
        fail('Trùng với một dòng phía trên');
        continue;
      }
      seen.add(key);
      valid.push({
        product_id: product.id,
        product_variant_id: variant?.id,
        mode,
        value,
      });
    }
    if (errors.length)
      throw new UnprocessableEntityException({
        code: 'PRICE_BOOK_IMPORT_INVALID',
        message: `${errors.length} dòng không hợp lệ; chưa có dòng nào được ghi`,
        errors,
      });

    await this.prisma.$transaction(
      async (tx) => {
        for (const dto of valid) await this.upsert(tx, id, dto);
      },
      { timeout: 120_000 },
    );
    return { imported: valid.length };
  }
}
