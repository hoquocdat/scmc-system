import axios from 'axios';
import { apiClient } from './client';

export type PromotionType = 'line_discount' | 'order_discount' | 'buy_x_get_y' | 'bundle';
export type DiscountKind = 'percent' | 'amount' | 'fixed_price';
export type TargetType = 'product' | 'variant' | 'category' | 'brand';
export type TargetRole = 'target' | 'buy' | 'get' | 'bundle';

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  line_discount: 'Giảm giá hàng hóa',
  order_discount: 'Giảm giá đơn hàng',
  buy_x_get_y: 'Mua X tặng Y',
  bundle: 'Combo giá ưu đãi',
};
export const DISCOUNT_KIND_LABELS: Record<DiscountKind, string> = { percent: 'Giảm %', amount: 'Giảm tiền', fixed_price: 'Đồng giá' };
export const TARGET_TYPE_LABELS: Record<TargetType, string> = { product: 'Sản phẩm', variant: 'Biến thể', category: 'Danh mục', brand: 'Thương hiệu' };
export const CHANNEL_LABELS: Record<string, string> = { pos: 'POS', retail_store: 'Đơn tại cửa hàng', workshop: 'Xưởng', phone: 'Điện thoại' };
export const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export interface PromotionTarget {
  role: TargetRole;
  target_type: TargetType;
  target_id: string;
  quantity?: number;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  type: PromotionType;
  is_active: boolean;
  priority: number;
  start_at: string | null;
  end_at: string | null;
  days_of_week: number[] | null;
  time_from: string | null;
  time_to: string | null;
  all_stores: boolean;
  all_customers: boolean;
  channels: string[] | null;
  combinable: boolean;
  discount_kind: DiscountKind | null;
  discount_value: number | null;
  max_discount: number | null;
  min_order_amount: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  get_discount_percent: number | null;
  bundle_price: number | null;
  notes: string | null;
  stores: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  targets: PromotionTarget[];
  target_names?: Record<string, string>;
  usage: { orders: number; discount: number };
}

export type PromotionInput = Partial<Omit<Promotion, 'id' | 'stores' | 'groups' | 'usage' | 'target_names' | 'all_stores' | 'all_customers'>> & {
  store_ids?: string[];
  group_ids?: string[];
};

export interface CartLineInput {
  product_id: string;
  product_variant_id?: string | null;
  quantity: number;
  discount_amount?: number;
}

export interface CartRequest {
  store_id: string;
  customer_id?: string | null;
  price_book_id?: string | null;
  channel?: string;
  discount_type?: 'fixed' | 'percent';
  discount_value?: number;
  voucher_code?: string | null;
  points_to_redeem?: number;
  lines: CartLineInput[];
}

export interface CartBreakdown {
  subtotal: number;
  line_discounts: number;
  line_promotion_discount: number;
  order_promotion_discount: number;
  order_discount: number;
  voucher_discount: number;
  loyalty_discount: number;
  tax: number;
  shipping: number;
  total: number;
  promotions: { id: string; code: string; name: string; type: PromotionType; amount: number; lines: { index: number; amount: number }[] }[];
  voucher: { code: string; ok: boolean; amount: number; reason?: string; campaignName?: string } | null;
  lines: { index: number; product_id: string; product_variant_id: string | null; unit_price: number; price_book_name: string | null; promotion_discount: number; line_total: number }[];
}

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

export const promotionsApi = {
  list: async (): Promise<Promotion[]> => (await apiClient.get('/promotions')).data,
  get: async (id: string): Promise<Promotion> => (await apiClient.get(`/promotions/${id}`)).data,
  create: async (dto: PromotionInput): Promise<Promotion> => (await apiClient.post('/promotions', dto)).data,
  update: async (id: string, dto: PromotionInput): Promise<Promotion> => (await apiClient.patch(`/promotions/${id}`, dto)).data,
  remove: async (id: string) => (await apiClient.delete(`/promotions/${id}`)).data,
  cart: async (dto: CartRequest): Promise<CartBreakdown> =>
    (await apiClient.post('/pricing/cart', { ...clean(dto), lines: dto.lines.map((l) => clean(l)) })).data,
};

/** Server message and code of a failed call. */
export function promotionError(error: unknown): { message: string; code?: string; data?: Record<string, unknown> } {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[]; code?: string } | undefined;
    const m = data?.message;
    return { message: Array.isArray(m) ? m.join('; ') : (m ?? error.message), code: data?.code, data: data as Record<string, unknown> };
  }
  return { message: error instanceof Error ? error.message : 'Lỗi không xác định' };
}
