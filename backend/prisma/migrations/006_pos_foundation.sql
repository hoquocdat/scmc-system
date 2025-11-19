-- Phase 1: POS Foundation Database Schema
-- This migration adds tables for Products, Inventory, Sales Orders, and POS operations

-- =============================================
-- 1. PRODUCT MANAGEMENT TABLES
-- =============================================

-- Product Categories (hierarchical)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_product_categories_active ON product_categories(is_active);
CREATE INDEX idx_product_categories_slug ON product_categories(slug);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Pricing
  cost_price DECIMAL(10, 2) DEFAULT 0,
  retail_price DECIMAL(10, 2) NOT NULL,
  sale_price DECIMAL(10, 2),
  sale_price_start_date TIMESTAMPTZ,
  sale_price_end_date TIMESTAMPTZ,

  -- Inventory Management
  reorder_point INT DEFAULT 0,
  reorder_quantity INT DEFAULT 0,

  -- Product Type
  product_type VARCHAR(50) DEFAULT 'physical', -- physical, service, digital

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Metadata
  weight DECIMAL(10, 2), -- in kg
  dimensions_length DECIMAL(10, 2), -- in cm
  dimensions_width DECIMAL(10, 2),
  dimensions_height DECIMAL(10, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

-- Product Variants (for size, color, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL, -- e.g., "Size L / Color Red"

  -- Variant attributes
  attributes JSONB, -- {size: "L", color: "Red"}

  -- Pricing overrides
  price_adjustment DECIMAL(10, 2) DEFAULT 0,
  cost_price_override DECIMAL(10, 2),
  retail_price_override DECIMAL(10, 2),

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_active ON product_variants(is_active);

-- =============================================
-- 2. INVENTORY MANAGEMENT TABLES
-- =============================================

-- Stock Locations
CREATE TABLE IF NOT EXISTS stock_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_locations_code ON stock_locations(code);
CREATE INDEX idx_stock_locations_active ON stock_locations(is_active);

-- Insert default locations
INSERT INTO stock_locations (name, code, city, is_default) VALUES
  ('HCMC Store', 'HCMC', 'Ho Chi Minh City', true),
  ('Hanoi Store', 'HANOI', 'Hanoi', false),
  ('Workshop', 'WORKSHOP', 'Ho Chi Minh City', false)
ON CONFLICT (code) DO NOTHING;

-- Inventory (stock levels per location per product/variant)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Stock levels
  quantity_on_hand INT DEFAULT 0,
  quantity_reserved INT DEFAULT 0, -- Reserved for orders
  quantity_on_order INT DEFAULT 0, -- Incoming from suppliers
  safety_stock INT DEFAULT 0,

  -- Calculated: available = on_hand - reserved - safety_stock

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_inventory_product_or_variant CHECK (
    (product_id IS NOT NULL AND product_variant_id IS NULL) OR
    (product_id IS NULL AND product_variant_id IS NOT NULL)
  ),
  CONSTRAINT chk_inventory_quantities CHECK (
    quantity_on_hand >= 0 AND
    quantity_reserved >= 0 AND
    quantity_on_order >= 0 AND
    safety_stock >= 0
  )
);

CREATE UNIQUE INDEX idx_inventory_location_product ON inventory(location_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX idx_inventory_location_variant ON inventory(location_id, product_variant_id) WHERE product_variant_id IS NOT NULL;
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_variant ON inventory(product_variant_id);

-- Inventory Transactions (audit trail)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

  transaction_type VARCHAR(50) NOT NULL, -- RECEIVE, ADJUST, TRANSFER_OUT, TRANSFER_IN, SALE, RETURN
  quantity INT NOT NULL, -- Positive or negative

  -- Cost tracking
  unit_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),

  -- Reference
  reference_type VARCHAR(50), -- PURCHASE_ORDER, SALES_ORDER, TRANSFER_ORDER, ADJUSTMENT
  reference_id UUID,

  -- Reason
  reason_code VARCHAR(50),
  notes TEXT,

  -- User tracking
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_transactions_location ON inventory_transactions(location_id);
CREATE INDEX idx_inventory_transactions_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_variant ON inventory_transactions(product_variant_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);
CREATE INDEX idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);

-- Transfer Orders (inter-location transfers)
CREATE TABLE IF NOT EXISTS transfer_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number VARCHAR(50) NOT NULL UNIQUE,

  from_location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,

  status VARCHAR(50) DEFAULT 'pending', -- pending, in_transit, received, cancelled

  -- Dates
  requested_date TIMESTAMPTZ DEFAULT NOW(),
  shipped_date TIMESTAMPTZ,
  received_date TIMESTAMPTZ,

  -- Users
  requested_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  shipped_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  received_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_transfer_different_locations CHECK (from_location_id != to_location_id)
);

CREATE INDEX idx_transfer_orders_number ON transfer_orders(transfer_number);
CREATE INDEX idx_transfer_orders_from_location ON transfer_orders(from_location_id);
CREATE INDEX idx_transfer_orders_to_location ON transfer_orders(to_location_id);
CREATE INDEX idx_transfer_orders_status ON transfer_orders(status);

-- Transfer Order Items
CREATE TABLE IF NOT EXISTS transfer_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_order_id UUID NOT NULL REFERENCES transfer_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

  quantity_requested INT NOT NULL,
  quantity_shipped INT DEFAULT 0,
  quantity_received INT DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_transfer_item_product_or_variant CHECK (
    (product_id IS NOT NULL AND product_variant_id IS NULL) OR
    (product_id IS NULL AND product_variant_id IS NOT NULL)
  ),
  CONSTRAINT chk_transfer_item_quantities CHECK (
    quantity_requested > 0 AND
    quantity_shipped >= 0 AND
    quantity_received >= 0 AND
    quantity_shipped <= quantity_requested AND
    quantity_received <= quantity_shipped
  )
);

CREATE INDEX idx_transfer_order_items_transfer ON transfer_order_items(transfer_order_id);
CREATE INDEX idx_transfer_order_items_product ON transfer_order_items(product_id);
CREATE INDEX idx_transfer_order_items_variant ON transfer_order_items(product_variant_id);

-- =============================================
-- 3. SALES & POS TABLES
-- =============================================

-- Sales Orders (multi-channel)
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) NOT NULL UNIQUE,

  -- Customer
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),

  -- Order source
  channel VARCHAR(50) NOT NULL, -- pos, phone, ecommerce
  location_id UUID REFERENCES stock_locations(id) ON DELETE SET NULL,

  -- Order status
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, processing, ready_to_ship, shipped, delivered, cancelled, returned
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, partial, paid, refunded

  -- Shipping
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_method VARCHAR(50), -- standard, express, same_day, pickup
  tracking_number VARCHAR(100),

  -- Dates
  order_date TIMESTAMPTZ DEFAULT NOW(),
  payment_date TIMESTAMPTZ,
  shipped_date TIMESTAMPTZ,
  delivered_date TIMESTAMPTZ,

  -- Amounts
  subtotal DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) DEFAULT 0,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Users
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_channel ON sales_orders(channel);
CREATE INDEX idx_sales_orders_location ON sales_orders(location_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_payment_status ON sales_orders(payment_status);
CREATE INDEX idx_sales_orders_order_date ON sales_orders(order_date DESC);
CREATE INDEX idx_sales_orders_customer_phone ON sales_orders(customer_phone);

-- Sales Order Items
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,

  -- Product details (snapshot at time of sale)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  variant_name VARCHAR(255),

  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,

  -- Cost for margin calculation
  unit_cost DECIMAL(10, 2),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_sales_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_sales_order_items_amounts CHECK (
    unit_price >= 0 AND
    discount_amount >= 0 AND
    tax_amount >= 0 AND
    total_amount >= 0
  )
);

CREATE INDEX idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_sales_order_items_product ON sales_order_items(product_id);
CREATE INDEX idx_sales_order_items_variant ON sales_order_items(product_variant_id);

-- Sales Order Payments
CREATE TABLE IF NOT EXISTS sales_order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,

  payment_method VARCHAR(50) NOT NULL, -- cash, card, ewallet_momo, ewallet_zalopay, ewallet_vnpay, bank_transfer
  amount DECIMAL(10, 2) NOT NULL,

  -- Payment details
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  transaction_id VARCHAR(255), -- External payment transaction ID
  authorization_code VARCHAR(100),

  -- Cash handling
  amount_tendered DECIMAL(10, 2), -- For cash payments
  change_given DECIMAL(10, 2), -- For cash payments

  -- Status
  status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed, refunded

  notes TEXT,

  received_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_sales_order_payments_amount CHECK (amount > 0)
);

CREATE INDEX idx_sales_order_payments_order ON sales_order_payments(sales_order_id);
CREATE INDEX idx_sales_order_payments_method ON sales_order_payments(payment_method);
CREATE INDEX idx_sales_order_payments_date ON sales_order_payments(payment_date DESC);
CREATE INDEX idx_sales_order_payments_status ON sales_order_payments(status);

-- POS Sessions (shift management)
CREATE TABLE IF NOT EXISTS pos_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_number VARCHAR(50) NOT NULL UNIQUE,

  location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  -- Session status
  status VARCHAR(50) DEFAULT 'open', -- open, closed

  -- Cash handling
  opening_cash DECIMAL(10, 2) DEFAULT 0,
  closing_cash DECIMAL(10, 2),
  expected_cash DECIMAL(10, 2),
  cash_difference DECIMAL(10, 2), -- Actual vs Expected

  -- Timestamps
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_sessions_number ON pos_sessions(session_number);
CREATE INDEX idx_pos_sessions_location ON pos_sessions(location_id);
CREATE INDEX idx_pos_sessions_user ON pos_sessions(user_id);
CREATE INDEX idx_pos_sessions_status ON pos_sessions(status);
CREATE INDEX idx_pos_sessions_opened_at ON pos_sessions(opened_at DESC);

-- POS Session Transactions (cash drops, paid-ins)
CREATE TABLE IF NOT EXISTS pos_session_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pos_session_id UUID NOT NULL REFERENCES pos_sessions(id) ON DELETE CASCADE,

  transaction_type VARCHAR(50) NOT NULL, -- cash_drop, paid_in, payout
  amount DECIMAL(10, 2) NOT NULL,

  reason TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_pos_session_transactions_amount CHECK (amount != 0)
);

CREATE INDEX idx_pos_session_transactions_session ON pos_session_transactions(pos_session_id);
CREATE INDEX idx_pos_session_transactions_type ON pos_session_transactions(transaction_type);

-- =============================================
-- 4. EXTEND EXISTING ENUMS
-- =============================================

-- Add new user roles for retail operations
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'store_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_associate';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'warehouse_staff';

-- Add new payment methods
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'ewallet_momo';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'ewallet_zalopay';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'ewallet_vnpay';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'bank_transfer';

-- =============================================
-- 5. FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update inventory from transactions
CREATE OR REPLACE FUNCTION update_inventory_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update inventory quantities based on transaction type
  IF NEW.transaction_type IN ('RECEIVE', 'ADJUST', 'RETURN') THEN
    -- Increase inventory
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + NEW.quantity,
        updated_at = NOW()
    WHERE location_id = NEW.location_id
      AND (product_id = NEW.product_id OR product_variant_id = NEW.product_variant_id);

  ELSIF NEW.transaction_type IN ('SALE', 'TRANSFER_OUT') THEN
    -- Decrease inventory
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand - ABS(NEW.quantity),
        updated_at = NOW()
    WHERE location_id = NEW.location_id
      AND (product_id = NEW.product_id OR product_variant_id = NEW.product_variant_id);

  ELSIF NEW.transaction_type = 'TRANSFER_IN' THEN
    -- Increase inventory at destination
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + NEW.quantity,
        updated_at = NOW()
    WHERE location_id = NEW.location_id
      AND (product_id = NEW.product_id OR product_variant_id = NEW.product_variant_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update inventory
CREATE TRIGGER trg_inventory_transaction_update
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_transaction();

-- Function to update sales order totals
CREATE OR REPLACE FUNCTION update_sales_order_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate order totals when items change
  UPDATE sales_orders
  SET
    subtotal = (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM sales_order_items
      WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.sales_order_id, OLD.sales_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update order totals
CREATE TRIGGER trg_sales_order_items_totals
  AFTER INSERT OR UPDATE OR DELETE ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_totals();

-- Function to update sales order paid amount
CREATE OR REPLACE FUNCTION update_sales_order_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales_orders
  SET
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM sales_order_payments
      WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id)
        AND status = 'completed'
    ),
    payment_status = CASE
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM sales_order_payments
            WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id) AND status = 'completed') = 0 THEN 'unpaid'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM sales_order_payments
            WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id) AND status = 'completed') < total_amount THEN 'partial'
      ELSE 'paid'
    END,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.sales_order_id, OLD.sales_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update paid amount
CREATE TRIGGER trg_sales_order_payments_amount
  AFTER INSERT OR UPDATE OR DELETE ON sales_order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_paid_amount();

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  counter INT;
BEGIN
  -- Format: SO-YYYYMMDD-XXXX (e.g., SO-20250110-0001)
  SELECT COUNT(*) + 1 INTO counter
  FROM sales_orders
  WHERE DATE(order_date) = CURRENT_DATE;

  new_number := 'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate transfer order numbers
CREATE OR REPLACE FUNCTION generate_transfer_order_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  counter INT;
BEGIN
  -- Format: TR-YYYYMMDD-XXXX (e.g., TR-20250110-0001)
  SELECT COUNT(*) + 1 INTO counter
  FROM transfer_orders
  WHERE DATE(requested_date) = CURRENT_DATE;

  new_number := 'TR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate POS session numbers
CREATE OR REPLACE FUNCTION generate_pos_session_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  counter INT;
BEGIN
  -- Format: PS-YYYYMMDD-XXXX (e.g., PS-20250110-0001)
  SELECT COUNT(*) + 1 INTO counter
  FROM pos_sessions
  WHERE DATE(opened_at) = CURRENT_DATE;

  new_number := 'PS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. SAMPLE DATA (Optional - for testing)
-- =============================================

-- Insert sample product category
INSERT INTO product_categories (name, slug, description) VALUES
  ('Motorcycle Parts', 'motorcycle-parts', 'Parts and components for motorcycles'),
  ('Denim Products', 'denim-products', 'Denim jeans, jackets, and apparel')
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE products IS 'POS products catalog';
COMMENT ON TABLE product_categories IS 'Hierarchical product categories';
COMMENT ON TABLE inventory IS 'Stock levels per location';
COMMENT ON TABLE sales_orders IS 'Customer orders from all channels';
COMMENT ON TABLE pos_sessions IS 'POS shift/cash drawer sessions';
