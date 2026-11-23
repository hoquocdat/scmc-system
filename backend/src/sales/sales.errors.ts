import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

/** Error codes the POS client switches on (design D3). */
export const SalesErrorCode = {
  PRICE_CHANGED: 'PRICE_CHANGED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  DISCOUNT_APPROVAL_REQUIRED: 'DISCOUNT_APPROVAL_REQUIRED',
  SHIFT_NOT_OPEN: 'SHIFT_NOT_OPEN',
  PAYMENT_RULE: 'PAYMENT_RULE',
} as const;

export interface PriceChange {
  product_id: string;
  product_variant_id: string | null;
  sku: string;
  name: string;
  expected_unit_price: number;
  unit_price: number;
}

export class PriceChangedException extends ConflictException {
  constructor(public readonly changes: PriceChange[]) {
    super({
      code: SalesErrorCode.PRICE_CHANGED,
      message: `Giá đã thay đổi: ${changes.map((c) => `${c.name} (${c.unit_price.toLocaleString('vi-VN')})`).join(', ')}`,
      changes,
    });
  }
}

export interface StockShortage {
  product_id: string;
  product_variant_id: string | null;
  sku: string;
  name: string;
  requested: number;
  available: number;
}

export class InsufficientStockException extends ConflictException {
  constructor(public readonly shortages: StockShortage[]) {
    super({
      code: SalesErrorCode.INSUFFICIENT_STOCK,
      message: `Không đủ tồn kho: ${shortages.map((s) => `${s.name} (còn ${s.available})`).join(', ')}`,
      shortages,
    });
  }
}

export class DiscountApprovalRequiredException extends ForbiddenException {
  constructor(
    public readonly requestedPercent: number,
    public readonly maxPercent: number,
  ) {
    super({
      code: SalesErrorCode.DISCOUNT_APPROVAL_REQUIRED,
      message: `Giảm giá ${requestedPercent}% vượt mức cho phép (${maxPercent}%). Cần quản lý phê duyệt.`,
      requestedPercent,
      maxPercent,
    });
  }
}

export class ShiftNotOpenException extends ConflictException {
  constructor() {
    super({
      code: SalesErrorCode.SHIFT_NOT_OPEN,
      message: 'Chưa mở ca. Hãy mở ca trước khi bán hàng.',
    });
  }
}

export class PaymentRuleException extends UnprocessableEntityException {
  constructor(message: string) {
    super({ code: SalesErrorCode.PAYMENT_RULE, message });
  }
}
