import { ReportScope } from './report-scope';

export type ReportColumnType =
  | 'text'
  | 'integer'
  | 'number'
  | 'money'
  | 'percent'
  | 'date'
  | 'datetime';

/** Column definition shared by the on-screen table and the exported file. */
export interface ReportColumn {
  key: string;
  header: { vi: string; en: string };
  type: ReportColumnType;
}

/** Common envelope for every report. */
export interface ReportResult<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Report identifier, e.g. "sales.summary"; also used for file names. */
  report: string;
  title: { vi: string; en: string };
  scope: ReturnType<ReportScope['toJSON']>;
  columns: ReportColumn[];
  rows: Row[];
  totals?: Partial<Row>;
  /** Paging and other report-specific information. */
  meta?: Record<string, unknown>;
}

export interface PagedMeta {
  page: number;
  pageSize: number;
  total: number;
}

export const col = (
  key: string,
  vi: string,
  en: string,
  type: ReportColumnType = 'text',
): ReportColumn => ({
  key,
  header: { vi, en },
  type,
});

/**
 * Payment method names as stored by the retail (sales_order_payments) and
 * workshop (payments) modules, mapped to one reporting vocabulary.
 */
const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: 'cash',
  card: 'card',
  transfer: 'bank_transfer',
  bank_transfer: 'bank_transfer',
  ewallet_momo: 'ewallet_momo',
  ewallet_zalopay: 'ewallet_zalopay',
  ewallet_vnpay: 'ewallet_vnpay',
};

export function normalizePaymentMethod(
  method: string | null | undefined,
): string {
  if (!method) return 'other';
  return PAYMENT_METHOD_MAP[method.toLowerCase()] ?? method.toLowerCase();
}

export const PAYMENT_METHOD_LABELS: Record<string, { vi: string; en: string }> =
  {
    cash: { vi: 'Tiền mặt', en: 'Cash' },
    card: { vi: 'Thẻ', en: 'Card' },
    bank_transfer: { vi: 'Chuyển khoản', en: 'Bank transfer' },
    ewallet_momo: { vi: 'MoMo', en: 'MoMo' },
    ewallet_zalopay: { vi: 'ZaloPay', en: 'ZaloPay' },
    ewallet_vnpay: { vi: 'VNPay', en: 'VNPay' },
    other: { vi: 'Khác', en: 'Other' },
  };

/** Postgres returns numeric/bigint aggregates as strings or Decimal; coerce to number. */
export const num = (v: unknown): number => (v == null ? 0 : Number(v));
