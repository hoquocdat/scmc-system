import { apiClient } from './client';

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // Relations
  product_categories?: {
    id: string;
    name: string;
    slug: string;
  } | null; // parent category
  other_product_categories?: {
    id: string;
    name: string;
    slug: string;
    display_order: number;
    is_active: boolean;
  }[]; // child categories
  _count?: {
    products: number;
    other_product_categories: number;
  };
}

export interface CreateProductCategoryDto {
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  display_order?: number;
}

export interface UpdateProductCategoryDto {
  name?: string;
  slug?: string;
  description?: string;
  parent_id?: string;
  display_order?: number;
  is_active?: boolean;
}

export const productCategoriesApi = {
  getAll: async (): Promise<ProductCategory[]> => {
    const response = await apiClient.get('/product-categories');
    return response.data;
  },

  getOne: async (id: string): Promise<ProductCategory> => {
    const response = await apiClient.get(`/product-categories/${id}`);
    return response.data;
  },

  create: async (data: CreateProductCategoryDto): Promise<ProductCategory> => {
    const response = await apiClient.post('/product-categories', data);
    return response.data;
  },

  update: async (id: string, data: UpdateProductCategoryDto): Promise<ProductCategory> => {
    const response = await apiClient.patch(`/product-categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/product-categories/${id}`);
  },
};
