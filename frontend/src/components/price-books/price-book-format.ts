import { formatCurrency } from '@/lib/utils';
import type { PriceBook, PriceBookMode } from '@/lib/api/price-books';

/** "Giảm 10%", "Giảm 50.000 ₫" or the fixed price. */
export function ruleLabel(mode: PriceBookMode, value: number): string {
  if (mode === 'percent_off') return `Giảm ${value}%`;
  if (mode === 'amount_off') return `Giảm ${formatCurrency(value)}`;
  return formatCurrency(value);
}

const fmt = (iso: string) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** "Từ … đến …", "Không thời hạn". */
export function periodLabel(book: Pick<PriceBook, 'start_at' | 'end_at'>): string {
  if (!book.start_at && !book.end_at) return 'Không thời hạn';
  if (book.start_at && book.end_at) return `${fmt(book.start_at)} → ${fmt(book.end_at)}`;
  return book.start_at ? `Từ ${fmt(book.start_at)}` : `Đến ${fmt(book.end_at!)}`;
}

/** Current state of a book: inactive, scheduled, expired or applying. */
export function bookStatus(book: Pick<PriceBook, 'is_active' | 'start_at' | 'end_at'>, now = new Date()) {
  if (!book.is_active) return { label: 'Ngừng áp dụng', variant: 'outline' as const };
  if (book.start_at && new Date(book.start_at) > now) return { label: 'Sắp áp dụng', variant: 'secondary' as const };
  if (book.end_at && new Date(book.end_at) < now) return { label: 'Hết hạn', variant: 'outline' as const };
  return { label: 'Đang áp dụng', variant: 'default' as const };
}
