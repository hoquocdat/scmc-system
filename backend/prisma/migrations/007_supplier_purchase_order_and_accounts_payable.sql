-- Migration: Supplier, Purchase Order, and Accounts Payable Management
-- This migration creates tables for managing purchase orders, supplier payments, returns, and accounts payable tracking

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Purchase Order Status
CREATE TYPE purchase_order_status AS ENUM (
  'draft',                -- Initial state, can be edited
  'pending_approval',     -- Submitted for approval
  'approved',             -- Approved, stock updated, creates payable
  'rejected',             -- Rejected by manager
  'cancelled'             -- Cancelled by creator
);

-- Purchase Order Payment Status
CREATE TYPE purchase_order_payment_status AS ENUM (
  'unpaid',              -- No payments made
  'partially_paid',      -- Some payments made but not fully paid
  'paid'                 -- Fully paid
);

-- Supplier Transaction Type
CREATE TYPE supplier_transaction_type AS ENUM (
  'purchase',            -- Purchase order received
  'return',              -- Product returned to supplier
  'payment'              -- Payment made to supplier
);

-- Supplier Payment Method (extend existing payment_method if needed)
-- Using existing payment_method enum from the schema

-- ============================================================================
-- PURCHASE ORDERS TABLE
-- ============================================================================

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- Order Status
  status purchase_order_status NOT NULL DEFAULT 'draft',
  payment_status purchase_order_payment_status NOT NULL DEFAULT 'unpaid',

  -- Financial Details
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Dates
  order_date TIMESTAMPTZ DEFAULT NOW(),
  expected_delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,

  -- Approval Workflow
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES user_profiles(id),
  rejection_reason TEXT,

  -- Stock Impact Tracking
  stock_updated BOOLEAN DEFAULT FALSE,
  stock_updated_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Audit Fields
  created_by_id UUID REFERENCES user_profiles(id),
  updated_by_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for purchase_orders
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_payment_status ON purchase_orders(payment_status);
CREATE INDEX idx_purchase_orders_order_number ON purchase_orders(order_number);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date DESC);
CREATE INDEX idx_purchase_orders_created_by ON purchase_orders(created_by_id);
CREATE INDEX idx_purchase_orders_approved_by ON purchase_orders(approved_by);

COMMENT ON TABLE purchase_orders IS 'Stores purchase orders to suppliers for product procurement';
COMMENT ON COLUMN purchase_orders.stock_updated IS 'Tracks if stock has been increased for this PO (prevents double-counting)';
COMMENT ON COLUMN purchase_orders.payment_status IS 'Automatically updated based on paid_amount vs total_amount';

-- ============================================================================
-- PURCHASE ORDER ITEMS TABLE
-- ============================================================================

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,

  -- Product Details (snapshot at time of order)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  variant_name VARCHAR(255),

  -- Quantities
  quantity_ordered INT NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INT DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_returned INT DEFAULT 0 CHECK (quantity_returned >= 0),

  -- Pricing
  unit_cost DECIMAL(10, 2) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(10, 2) NOT NULL,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_received_not_exceed_ordered CHECK (quantity_received <= quantity_ordered),
  CONSTRAINT check_returned_not_exceed_received CHECK (quantity_returned <= quantity_received),
  CONSTRAINT check_product_or_variant CHECK (
    (product_id IS NOT NULL AND product_variant_id IS NULL) OR
    (product_id IS NULL AND product_variant_id IS NOT NULL)
  )
);

-- Indexes for purchase_order_items
CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_product ON purchase_order_items(product_id);
CREATE INDEX idx_purchase_order_items_variant ON purchase_order_items(product_variant_id);

COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';
COMMENT ON COLUMN purchase_order_items.quantity_received IS 'Quantity actually received into stock';
COMMENT ON COLUMN purchase_order_items.quantity_returned IS 'Quantity returned to supplier';

-- ============================================================================
-- SUPPLIER PAYMENTS TABLE
-- ============================================================================

CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- Payment Details
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method payment_method NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),

  -- Transaction Details
  transaction_id VARCHAR(255),
  reference_number VARCHAR(100),

  -- Payment Allocation (can be distributed across multiple POs)
  notes TEXT,

  -- Audit Fields
  created_by_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_payments
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_supplier_payments_date ON supplier_payments(payment_date DESC);
CREATE INDEX idx_supplier_payments_number ON supplier_payments(payment_number);
CREATE INDEX idx_supplier_payments_created_by ON supplier_payments(created_by_id);

COMMENT ON TABLE supplier_payments IS 'Records payments made to suppliers';

-- ============================================================================
-- SUPPLIER PAYMENT ALLOCATIONS TABLE
-- ============================================================================

CREATE TABLE supplier_payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_payment_id UUID NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,

  -- Allocation Details
  amount_allocated DECIMAL(10, 2) NOT NULL CHECK (amount_allocated > 0),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_payment_allocations
CREATE INDEX idx_supplier_payment_allocations_payment ON supplier_payment_allocations(supplier_payment_id);
CREATE INDEX idx_supplier_payment_allocations_po ON supplier_payment_allocations(purchase_order_id);

COMMENT ON TABLE supplier_payment_allocations IS 'Tracks how payments are allocated to specific purchase orders';

-- ============================================================================
-- SUPPLIER RETURNS TABLE
-- ============================================================================

CREATE TABLE supplier_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,

  -- Return Details
  return_date TIMESTAMPTZ DEFAULT NOW(),
  total_return_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Reason
  reason TEXT,
  notes TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, completed

  -- Audit Fields
  created_by_id UUID REFERENCES user_profiles(id),
  approved_by_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_returns
CREATE INDEX idx_supplier_returns_supplier ON supplier_returns(supplier_id);
CREATE INDEX idx_supplier_returns_po ON supplier_returns(purchase_order_id);
CREATE INDEX idx_supplier_returns_date ON supplier_returns(return_date DESC);
CREATE INDEX idx_supplier_returns_number ON supplier_returns(return_number);
CREATE INDEX idx_supplier_returns_status ON supplier_returns(status);

COMMENT ON TABLE supplier_returns IS 'Tracks products returned to suppliers';

-- ============================================================================
-- SUPPLIER RETURN ITEMS TABLE
-- ============================================================================

CREATE TABLE supplier_return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_return_id UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,

  -- Quantity
  quantity_returned INT NOT NULL CHECK (quantity_returned > 0),

  -- Cost Details
  unit_cost DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,

  -- Reason
  reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_return_items
CREATE INDEX idx_supplier_return_items_return ON supplier_return_items(supplier_return_id);
CREATE INDEX idx_supplier_return_items_po_item ON supplier_return_items(purchase_order_item_id);
CREATE INDEX idx_supplier_return_items_product ON supplier_return_items(product_id);
CREATE INDEX idx_supplier_return_items_variant ON supplier_return_items(product_variant_id);

COMMENT ON TABLE supplier_return_items IS 'Line items for supplier returns';

-- ============================================================================
-- SUPPLIER TRANSACTIONS VIEW
-- ============================================================================
-- This view provides a unified view of all supplier financial transactions

CREATE VIEW supplier_transactions AS
  -- Purchase Orders (creates payable)
  SELECT
    po.id,
    'purchase'::supplier_transaction_type AS transaction_type,
    po.supplier_id,
    po.order_number AS reference_number,
    po.total_amount AS amount,
    po.order_date AS transaction_date,
    po.notes,
    po.created_at
  FROM purchase_orders po
  WHERE po.status = 'approved'

  UNION ALL

  -- Supplier Returns (reduces payable)
  SELECT
    sr.id,
    'return'::supplier_transaction_type AS transaction_type,
    sr.supplier_id,
    sr.return_number AS reference_number,
    -sr.total_return_amount AS amount, -- Negative because it reduces payable
    sr.return_date AS transaction_date,
    sr.notes,
    sr.created_at
  FROM supplier_returns sr
  WHERE sr.status = 'approved'

  UNION ALL

  -- Supplier Payments (reduces payable)
  SELECT
    sp.id,
    'payment'::supplier_transaction_type AS transaction_type,
    sp.supplier_id,
    sp.payment_number AS reference_number,
    -sp.amount AS amount, -- Negative because it reduces payable
    sp.payment_date AS transaction_date,
    sp.notes,
    sp.created_at
  FROM supplier_payments sp

  ORDER BY transaction_date DESC, created_at DESC;

COMMENT ON VIEW supplier_transactions IS 'Unified view of all supplier financial transactions (purchases, returns, payments)';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update purchase_order updated_at timestamp
CREATE OR REPLACE FUNCTION update_purchase_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_order_timestamp
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_timestamp();

-- Trigger to recalculate purchase order totals when items change
CREATE OR REPLACE FUNCTION recalculate_purchase_order_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET
    subtotal = (
      SELECT COALESCE(SUM(total_cost), 0)
      FROM purchase_order_items
      WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
    ),
    total_amount = COALESCE(subtotal, 0) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0) - COALESCE(discount_amount, 0)
  WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_po_totals_insert
  AFTER INSERT ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_purchase_order_totals();

CREATE TRIGGER trigger_recalculate_po_totals_update
  AFTER UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_purchase_order_totals();

CREATE TRIGGER trigger_recalculate_po_totals_delete
  AFTER DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_purchase_order_totals();

-- Trigger to update purchase order payment status
CREATE OR REPLACE FUNCTION update_purchase_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.paid_amount = 0 THEN
    NEW.payment_status = 'unpaid';
  ELSIF NEW.paid_amount >= NEW.total_amount THEN
    NEW.payment_status = 'paid';
  ELSE
    NEW.payment_status = 'partially_paid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_payment_status
  BEFORE UPDATE OF paid_amount, total_amount ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_payment_status();

-- Trigger to update purchase order paid_amount when payment allocations change
CREATE OR REPLACE FUNCTION update_purchase_order_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET paid_amount = (
    SELECT COALESCE(SUM(amount_allocated), 0)
    FROM supplier_payment_allocations
    WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
  )
  WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_paid_amount_insert
  AFTER INSERT ON supplier_payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_paid_amount();

CREATE TRIGGER trigger_update_po_paid_amount_delete
  AFTER DELETE ON supplier_payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_order_paid_amount();

-- Trigger to update supplier return total when items change
CREATE OR REPLACE FUNCTION update_supplier_return_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE supplier_returns
  SET total_return_amount = (
    SELECT COALESCE(SUM(total_cost), 0)
    FROM supplier_return_items
    WHERE supplier_return_id = COALESCE(NEW.supplier_return_id, OLD.supplier_return_id)
  )
  WHERE id = COALESCE(NEW.supplier_return_id, OLD.supplier_return_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_return_total_insert
  AFTER INSERT ON supplier_return_items
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_return_total();

CREATE TRIGGER trigger_update_supplier_return_total_update
  AFTER UPDATE ON supplier_return_items
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_return_total();

CREATE TRIGGER trigger_update_supplier_return_total_delete
  AFTER DELETE ON supplier_return_items
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_return_total();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_return_items ENABLE ROW LEVEL SECURITY;

-- Policies can be added based on your authentication setup
-- For now, allowing all operations for authenticated users

CREATE POLICY "Enable all for authenticated users" ON purchase_orders FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON purchase_order_items FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON supplier_payments FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON supplier_payment_allocations FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON supplier_returns FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON supplier_return_items FOR ALL USING (true);

-- ============================================================================
-- FUNCTIONS FOR BUSINESS LOGIC
-- ============================================================================

-- Function to calculate supplier accounts payable balance
CREATE OR REPLACE FUNCTION get_supplier_accounts_payable(p_supplier_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  total_purchases DECIMAL(10, 2),
  total_returns DECIMAL(10, 2),
  total_payments DECIMAL(10, 2),
  balance_due DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_supplier_id,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) AS total_purchases,
    COALESCE((SELECT SUM(total_return_amount) FROM supplier_returns WHERE supplier_id = p_supplier_id AND status = 'approved'), 0) AS total_returns,
    COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = p_supplier_id), 0) AS total_payments,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0)
    - COALESCE((SELECT SUM(total_return_amount) FROM supplier_returns WHERE supplier_id = p_supplier_id AND status = 'approved'), 0)
    - COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = p_supplier_id), 0) AS balance_due
  FROM purchase_orders
  WHERE supplier_id = p_supplier_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_supplier_accounts_payable IS 'Calculates the accounts payable balance for a supplier';

-- Function to get purchase order payment details
CREATE OR REPLACE FUNCTION get_purchase_order_payment_details(p_purchase_order_id UUID)
RETURNS TABLE (
  purchase_order_id UUID,
  total_amount DECIMAL(10, 2),
  paid_amount DECIMAL(10, 2),
  balance_due DECIMAL(10, 2),
  payment_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id,
    po.total_amount,
    po.paid_amount,
    po.total_amount - po.paid_amount AS balance_due,
    po.payment_status::TEXT
  FROM purchase_orders po
  WHERE po.id = p_purchase_order_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_purchase_order_payment_details IS 'Gets payment details for a purchase order';
