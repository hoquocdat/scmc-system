import * as z from 'zod';

// Helper for optional number fields that handles NaN from empty inputs
const optionalNumber = z.number().min(0).optional().or(z.nan().transform(() => undefined));

// Helper for optional date fields that converts empty strings to undefined
const optionalDate = z.string().optional().transform(val => {
  if (!val || val === '') return undefined;
  return val;
});

export const productSchema = z.object({
  sku: z.string().min(1, 'SKU là bắt buộc'),
  name: z.string().min(1, 'Tên sản phẩm là bắt buộc'),
  description: z.string().optional(),
  category_id: z.string().optional(),
  brand_id: z.string().optional(),
  supplier_id: z.string().optional(),
  cost_price: z.number().min(0, 'Giá vốn là bắt buộc'),
  retail_price: z.number().min(0, 'Giá bán là bắt buộc'),
  sale_price: optionalNumber,
  sale_price_start_date: optionalDate,
  sale_price_end_date: optionalDate,
  reorder_point: optionalNumber,
  reorder_quantity: optionalNumber,
  product_type: z.enum(['physical', 'service', 'digital']).default('physical'),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  weight: optionalNumber,
  dimensions_length: optionalNumber,
  dimensions_width: optionalNumber,
  dimensions_height: optionalNumber,
});

export type ProductFormData = z.infer<typeof productSchema>;

export interface ProductFormProps {
  register: any;
  errors: any;
  watch: any;
  setValue: any;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
  display_order: number;
}

export interface Brand {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  is_active: boolean;
}
