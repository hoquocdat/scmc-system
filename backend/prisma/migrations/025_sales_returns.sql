-- 025: sales returns, exchanges and customer credit (change sales-returns, design D1)
BEGIN;

-- =============================================
-- 1. Customer credit
-- =============================================
ALTER TABLE customers ADD COLUMN credit_balance NUMERIC(14, 2) NOT NULL DEFAULT 0;

CREATE TABLE customer_credit_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount        NUMERIC(14, 2) NOT NULL,
  balance_after NUMERIC(14, 2) NOT NULL,
  source_type   VARCHAR(30) NOT NULL,
  source_id     UUID,
  note          TEXT,
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_customer_credit_amount CHECK (amount <> 0),
  CONSTRAINT chk_customer_credit_source CHECK (source_type IN ('sales_return', 'sales_order_payment', 'adjustment'))
);
CREATE INDEX idx_customer_credit_tx_customer ON customer_credit_transactions(customer_id, created_at);

-- =============================================
-- 2. Returns
-- =============================================
CREATE TABLE sales_returns (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number        VARCHAR(30) NOT NULL UNIQUE,
  sales_order_id       UUID NOT NULL REFERENCES sales_orders(id),
  store_id             UUID REFERENCES stores(id),
  customer_id          UUID REFERENCES customers(id),
  pos_session_id       UUID REFERENCES pos_sessions(id),
  kind                 VARCHAR(10) NOT NULL DEFAULT 'return',
  exchange_order_id    UUID REFERENCES sales_orders(id),
  goods_amount         NUMERIC(14, 2) NOT NULL,
  receivable_reduction NUMERIC(14, 2) NOT NULL DEFAULT 0,
  refund_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  points_reversed      INTEGER NOT NULL DEFAULT 0,
  points_restored      INTEGER NOT NULL DEFAULT 0,
  reason               TEXT,
  notes                TEXT,
  approved_by          UUID REFERENCES user_profiles(id),
  created_by           UUID REFERENCES user_profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sales_returns_kind CHECK (kind IN ('return', 'exchange')),
  CONSTRAINT chk_sales_returns_amounts CHECK (goods_amount >= 0 AND receivable_reduction >= 0 AND refund_amount >= 0)
);
CREATE INDEX idx_sales_returns_order ON sales_returns(sales_order_id);
CREATE INDEX idx_sales_returns_store_date ON sales_returns(store_id, created_at);
CREATE INDEX idx_sales_returns_customer ON sales_returns(customer_id);

CREATE TABLE sales_return_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_return_id     UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  sales_order_item_id UUID NOT NULL REFERENCES sales_order_items(id),
  product_id          UUID REFERENCES products(id),
  product_variant_id  UUID REFERENCES product_variants(id),
  product_name        VARCHAR(255) NOT NULL,
  product_sku         VARCHAR(100),
  quantity            INTEGER NOT NULL,
  unit_refund         NUMERIC(14, 2) NOT NULL,
  line_refund         NUMERIC(14, 2) NOT NULL,
  unit_cost           NUMERIC(14, 2),
  restock             BOOLEAN NOT NULL DEFAULT true,
  location_id         UUID REFERENCES stock_locations(id),
  reason_code         VARCHAR(20) NOT NULL DEFAULT 'other',
  reason_note         TEXT,
  CONSTRAINT chk_sales_return_items_qty CHECK (quantity > 0),
  CONSTRAINT chk_sales_return_items_reason CHECK (reason_code IN ('changed_mind', 'wrong_size', 'defective', 'wrong_item', 'other')),
  CONSTRAINT chk_sales_return_items_location CHECK (NOT restock OR location_id IS NOT NULL)
);
CREATE INDEX idx_sales_return_items_return ON sales_return_items(sales_return_id);
CREATE INDEX idx_sales_return_items_order_item ON sales_return_items(sales_order_item_id);

CREATE TABLE sales_return_refunds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  method          VARCHAR(30) NOT NULL,
  amount          NUMERIC(14, 2) NOT NULL,
  cash_account_id UUID REFERENCES cash_book_accounts(id),
  CONSTRAINT chk_sales_return_refunds_amount CHECK (amount > 0),
  CONSTRAINT chk_sales_return_refunds_method CHECK (method IN (
    'cash', 'card', 'bank_transfer', 'ewallet_momo', 'ewallet_zalopay', 'ewallet_vnpay', 'store_credit', 'exchange'))
);
CREATE INDEX idx_sales_return_refunds_return ON sales_return_refunds(sales_return_id);

-- =============================================
-- 3. Returned amounts on orders
-- =============================================
ALTER TABLE sales_order_items
  ADD COLUMN returned_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN returned_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_sales_order_items_returned CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

ALTER TABLE sales_orders
  ADD COLUMN returned_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN return_status   VARCHAR(10) NOT NULL DEFAULT 'none',
  ADD CONSTRAINT chk_sales_orders_return_status CHECK (return_status IN ('none', 'partial', 'full'));

-- =============================================
-- 4. Cash book category and permissions
-- =============================================
INSERT INTO cash_book_categories (code, name, direction, is_system) VALUES
  ('sales_return', 'Trả hàng', 'out', true)
ON CONFLICT (code, direction) DO NOTHING;

INSERT INTO permissions (name, resource, action, description) VALUES
  ('sales_returns:read',    'sales_returns', 'read',    'View sales returns'),
  ('sales_returns:create',  'sales_returns', 'create',  'Create sales returns and exchanges'),
  ('sales_returns:approve', 'sales_returns', 'approve', 'Approve returns above the limit or after the return window')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('manager', 'superadmin', 'store_manager') AND p.resource = 'sales_returns'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('sales', 'sales_associate') AND p.name IN ('sales_returns:read', 'sales_returns:create')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'finance' AND p.name = 'sales_returns:read'
ON CONFLICT DO NOTHING;

COMMIT;
