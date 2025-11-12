-- Migration: Product Attributes with JSONB and Master-Variant Relationship
-- Description: Adds JSONB-based attributes, master-variant hierarchy, and attribute definitions

-- =============================================================================
-- 1. Add new columns to products table
-- =============================================================================

-- Add master-variant relationship
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS master_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS variant_generation_type VARCHAR(50) DEFAULT 'manual';

-- Add JSONB attributes column with default empty object
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN products.master_product_id IS 'References the master product for variants. NULL for master products.';
COMMENT ON COLUMN products.is_master IS 'TRUE for master products, FALSE for variant products';
COMMENT ON COLUMN products.variant_generation_type IS 'How variants are created: manual, automatic, attribute_based';
COMMENT ON COLUMN products.attributes IS 'JSONB storage for flexible product attributes (color, size, etc.)';

-- =============================================================================
-- 2. Create indexes for performance
-- =============================================================================

-- Index for master-variant queries
CREATE INDEX IF NOT EXISTS idx_products_master_product ON products(master_product_id) WHERE master_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_master ON products(is_master);

-- GIN index for JSONB attribute queries (crucial for performance)
CREATE INDEX IF NOT EXISTS idx_products_attributes_gin ON products USING GIN (attributes);

-- Additional index for path-based queries on specific attributes
CREATE INDEX IF NOT EXISTS idx_products_attributes_color ON products ((attributes->>'color')) WHERE attributes ? 'color';
CREATE INDEX IF NOT EXISTS idx_products_attributes_size ON products ((attributes->>'size')) WHERE attributes ? 'size';

-- =============================================================================
-- 3. Create attribute_definitions table (for UI generation and validation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS attribute_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Attribute configuration
  input_type VARCHAR(50) DEFAULT 'select', -- select, color, text, number, boolean, multiselect
  data_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, array
  is_variant_attribute BOOLEAN DEFAULT true, -- Used for generating variants
  is_filterable BOOLEAN DEFAULT true, -- Show in product filters
  is_required BOOLEAN DEFAULT false,

  -- Options for select/multiselect types (stored as JSONB array)
  -- Example: [{"value": "red", "label": "Red", "color_code": "#FF0000"}, ...]
  options JSONB DEFAULT '[]',

  -- Validation rules
  validation_rules JSONB DEFAULT '{}', -- {"min": 0, "max": 100, "pattern": "..."}

  -- UI configuration
  display_order INT DEFAULT 0,
  icon VARCHAR(100), -- Icon name for UI
  help_text TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for attribute_definitions
CREATE INDEX IF NOT EXISTS idx_attr_def_slug ON attribute_definitions(slug);
CREATE INDEX IF NOT EXISTS idx_attr_def_active ON attribute_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_attr_def_variant ON attribute_definitions(is_variant_attribute) WHERE is_variant_attribute = true;
CREATE INDEX IF NOT EXISTS idx_attr_def_filterable ON attribute_definitions(is_filterable) WHERE is_filterable = true;
CREATE INDEX IF NOT EXISTS idx_attr_def_order ON attribute_definitions(display_order);

-- GIN index for options JSONB
CREATE INDEX IF NOT EXISTS idx_attr_def_options_gin ON attribute_definitions USING GIN (options);

-- Comments for documentation
COMMENT ON TABLE attribute_definitions IS 'Defines available product attributes for UI generation and validation';
COMMENT ON COLUMN attribute_definitions.options IS 'JSONB array of possible values: [{"value": "red", "label": "Red", "color_code": "#FF0000"}]';
COMMENT ON COLUMN attribute_definitions.validation_rules IS 'JSONB validation rules: {"min": 0, "max": 100, "pattern": "regex"}';

-- =============================================================================
-- 4. Insert common attribute definitions
-- =============================================================================

INSERT INTO attribute_definitions (name, slug, input_type, data_type, is_variant_attribute, options, display_order, is_active)
VALUES
  -- Color attribute
  (
    'Màu sắc',
    'color',
    'color',
    'string',
    true,
    '[
      {"value": "red", "label": "Đỏ", "color_code": "#FF0000"},
      {"value": "blue", "label": "Xanh dương", "color_code": "#0000FF"},
      {"value": "green", "label": "Xanh lá", "color_code": "#00FF00"},
      {"value": "black", "label": "Đen", "color_code": "#000000"},
      {"value": "white", "label": "Trắng", "color_code": "#FFFFFF"},
      {"value": "yellow", "label": "Vàng", "color_code": "#FFFF00"},
      {"value": "orange", "label": "Cam", "color_code": "#FFA500"},
      {"value": "purple", "label": "Tím", "color_code": "#800080"},
      {"value": "pink", "label": "Hồng", "color_code": "#FFC0CB"},
      {"value": "gray", "label": "Xám", "color_code": "#808080"}
    ]'::jsonb,
    1,
    true
  ),

  -- Size attribute
  (
    'Kích thước',
    'size',
    'select',
    'string',
    true,
    '[
      {"value": "xs", "label": "XS"},
      {"value": "s", "label": "S"},
      {"value": "m", "label": "M"},
      {"value": "l", "label": "L"},
      {"value": "xl", "label": "XL"},
      {"value": "xxl", "label": "XXL"},
      {"value": "xxxl", "label": "XXXL"}
    ]'::jsonb,
    2,
    true
  ),

  -- Material attribute
  (
    'Chất liệu',
    'material',
    'select',
    'string',
    false,
    '[
      {"value": "cotton", "label": "Cotton"},
      {"value": "polyester", "label": "Polyester"},
      {"value": "silk", "label": "Lụa"},
      {"value": "leather", "label": "Da"},
      {"value": "wool", "label": "Len"},
      {"value": "denim", "label": "Denim"},
      {"value": "nylon", "label": "Nylon"}
    ]'::jsonb,
    3,
    true
  ),

  -- Weight attribute (for products that need it)
  (
    'Khối lượng',
    'weight_kg',
    'number',
    'number',
    false,
    '[]'::jsonb,
    4,
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 5. Create helper function for attribute queries
-- =============================================================================

-- Function to find products by multiple attributes
CREATE OR REPLACE FUNCTION find_products_by_attributes(
  p_attributes JSONB
)
RETURNS TABLE (
  product_id UUID,
  sku VARCHAR(100),
  name VARCHAR(255),
  attributes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.sku,
    p.name,
    p.attributes
  FROM products p
  WHERE p.attributes @> p_attributes
    AND p.is_active = true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_products_by_attributes IS 'Find products that match all specified attributes using JSONB containment operator';

-- Function to get all variants of a master product
CREATE OR REPLACE FUNCTION get_product_variants(
  p_master_product_id UUID
)
RETURNS TABLE (
  variant_id UUID,
  sku VARCHAR(100),
  name VARCHAR(255),
  attributes JSONB,
  retail_price DECIMAL(10,2),
  stock_quantity BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.sku,
    p.name,
    p.attributes,
    p.retail_price,
    COALESCE(SUM(i.quantity_on_hand), 0) as stock_quantity
  FROM products p
  LEFT JOIN inventory i ON i.product_id = p.id
  WHERE p.master_product_id = p_master_product_id
    AND p.is_active = true
  GROUP BY p.id, p.sku, p.name, p.attributes, p.retail_price;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_product_variants IS 'Get all variants of a master product with their stock quantities';

-- =============================================================================
-- 6. Add triggers for updated_at
-- =============================================================================

-- Trigger for attribute_definitions
CREATE OR REPLACE FUNCTION update_attribute_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_attribute_definitions_updated_at
  BEFORE UPDATE ON attribute_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_attribute_definitions_updated_at();

-- =============================================================================
-- 7. Data migration: Convert existing product_variants to new system
-- =============================================================================

-- Note: If you have existing data in product_variants table,
-- you would migrate it here. Since this is a new feature, we'll skip this.

-- Example migration (commented out):
-- UPDATE products p
-- SET attributes = pv.attributes
-- FROM product_variants pv
-- WHERE pv.product_id = p.id;

-- =============================================================================
-- Migration complete
-- =============================================================================

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Migration 006_product_attributes_jsonb completed successfully';
  RAISE NOTICE 'Added columns: master_product_id, is_master, variant_generation_type, attributes';
  RAISE NOTICE 'Created table: attribute_definitions';
  RAISE NOTICE 'Created indexes for JSONB queries';
  RAISE NOTICE 'Inserted % attribute definitions', (SELECT COUNT(*) FROM attribute_definitions);
END $$;
