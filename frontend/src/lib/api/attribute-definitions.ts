import { apiClient } from './client';

export interface AttributeOption {
  value: string;
  label: string;
  color_code?: string;
}

export interface AttributeDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  input_type: 'select' | 'color' | 'text' | 'number' | 'boolean' | 'multiselect';
  data_type: 'string' | 'number' | 'boolean' | 'array';
  is_variant_attribute: boolean;
  is_filterable: boolean;
  is_required: boolean;
  options: AttributeOption[];
  validation_rules: Record<string, any>;
  display_order: number;
  icon?: string;
  help_text?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAttributeDefinitionDto {
  name: string;
  slug: string;
  description?: string;
  input_type?: 'select' | 'color' | 'text' | 'number' | 'boolean' | 'multiselect';
  data_type?: 'string' | 'number' | 'boolean' | 'array';
  is_variant_attribute?: boolean;
  is_filterable?: boolean;
  is_required?: boolean;
  options?: AttributeOption[];
  validation_rules?: Record<string, any>;
  display_order?: number;
  icon?: string;
  help_text?: string;
  is_active?: boolean;
}

export interface UpdateAttributeDefinitionDto
  extends Partial<CreateAttributeDefinitionDto> {}

export const attributeDefinitionsApi = {
  /**
   * Get all attribute definitions
   */
  getAll: async (includeInactive = false): Promise<AttributeDefinition[]> => {
    const response = await apiClient.get('/attribute-definitions', {
      params: { includeInactive },
    });
    return response.data;
  },

  /**
   * Get variant attributes only (used for product variant generation)
   */
  getVariantAttributes: async (): Promise<AttributeDefinition[]> => {
    const response = await apiClient.get('/attribute-definitions/variant');
    return response.data;
  },

  /**
   * Get filterable attributes only (used for product filtering UI)
   */
  getFilterableAttributes: async (): Promise<AttributeDefinition[]> => {
    const response = await apiClient.get('/attribute-definitions/filterable');
    return response.data;
  },

  /**
   * Get single attribute definition by ID
   */
  getById: async (id: string): Promise<AttributeDefinition> => {
    const response = await apiClient.get(`/attribute-definitions/${id}`);
    return response.data;
  },

  /**
   * Get attribute definition by slug
   */
  getBySlug: async (slug: string): Promise<AttributeDefinition> => {
    const response = await apiClient.get(`/attribute-definitions/slug/${slug}`);
    return response.data;
  },

  /**
   * Create new attribute definition
   */
  create: async (
    data: CreateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> => {
    const response = await apiClient.post('/attribute-definitions', data);
    return response.data;
  },

  /**
   * Update attribute definition
   */
  update: async (
    id: string,
    data: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> => {
    const response = await apiClient.patch(
      `/attribute-definitions/${id}`,
      data,
    );
    return response.data;
  },

  /**
   * Delete (soft delete) attribute definition
   */
  delete: async (id: string): Promise<AttributeDefinition> => {
    const response = await apiClient.delete(`/attribute-definitions/${id}`);
    return response.data;
  },

  /**
   * Hard delete attribute definition
   */
  hardDelete: async (id: string): Promise<AttributeDefinition> => {
    const response = await apiClient.delete(
      `/attribute-definitions/${id}/hard`,
    );
    return response.data;
  },

  /**
   * Reorder attribute definitions
   */
  reorder: async (
    orderMap: Record<string, number>,
  ): Promise<{ message: string }> => {
    const response = await apiClient.post(
      '/attribute-definitions/reorder',
      orderMap,
    );
    return response.data;
  },
};
