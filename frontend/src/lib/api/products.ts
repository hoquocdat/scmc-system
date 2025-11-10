import { apiClient } from './client';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  brand_id?: string;
  supplier_id?: string;
  cost_price?: number;
  retail_price: number;
  sale_price?: number;
  sale_price_start_date?: string;
  sale_price_end_date?: string;
  reorder_point: number;
  reorder_quantity: number;
  product_type: string;
  is_active: boolean;
  is_featured: boolean;
  weight?: number;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  created_at: string;
  updated_at: string;
  product_categories?: {
    id: string;
    name: string;
    slug: string;
  };
  brands?: {
    id: string;
    name: string;
  };
  suppliers?: {
    id: string;
    name: string;
  };
  product_variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  attribute_values: Record<string, string>;
  price_adjustment: number;
  is_active: boolean;
}

export interface ProductQueryParams {
  search?: string;
  category_id?: string;
  brand_id?: string;
  supplier_id?: string;
  product_type?: string;
  is_active?: boolean;
  is_featured?: boolean;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ProductsResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateProductDto {
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  brand_id?: string;
  supplier_id?: string;
  cost_price?: number;
  retail_price: number;
  sale_price?: number;
  sale_price_start_date?: string;
  sale_price_end_date?: string;
  reorder_point?: number;
  reorder_quantity?: number;
  product_type?: string;
  is_active?: boolean;
  is_featured?: boolean;
  weight?: number;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export const productsApi = {
  // Get all products with filtering
  getAll: async (params?: ProductQueryParams): Promise<ProductsResponse> => {
    const response = await apiClient.get('/products', { params });
    return response.data;
  },

  // Get single product by ID
  getById: async (id: string): Promise<Product> => {
    const response = await apiClient.get(`/products/${id}`);
    return response.data;
  },

  // Get low stock products
  getLowStock: async (locationId?: string): Promise<Product[]> => {
    const response = await apiClient.get('/products/low-stock', {
      params: { locationId },
    });
    return response.data;
  },

  // Create new product
  create: async (data: CreateProductDto): Promise<Product> => {
    const response = await apiClient.post('/products', data);
    return response.data;
  },

  // Update product
  update: async (id: string, data: UpdateProductDto): Promise<Product> => {
    const response = await apiClient.patch(`/products/${id}`, data);
    return response.data;
  },

  // Delete (soft delete) product
  delete: async (id: string): Promise<Product> => {
    const response = await apiClient.delete(`/products/${id}`);
    return response.data;
  },
};
