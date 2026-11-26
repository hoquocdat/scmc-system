-- Migration: POS checkout core
-- Design: openspec/changes/pos-checkout-core/design.md (D4, D6, D7, D8, D9)
--
--   1. document_counters + race-free, never-reused sales order numbers (D7)
--   2. sales_orders: pos_session_id, client_request_id (idempotency), discount_approved_by (D3, D4, D9)
--   3. pos_sessions: store_id (backfilled), closed_by, one open shift per user (D8)
--   4. roles.max_discount_percent (D9)
--   5. POS permissions: approve, credit, supervise, reprint + default grants (D9)
--      (named 'supervise', not 'manage': CASL treats 'manage' as every action)
--   6. Inventory trigger: variant movements only touch the variant row (D6)
--
-- Rollback: prisma/migrations/rollback/021_pos_checkout_core.sql

-- =============================================
-- 1. Document counters and order numbering
-- =============================================
CREATE TABLE IF NOT EXISTS document_counters (
  doc_type   VARCHAR(20) NOT NULL,
  period     VARCHAR(20) NOT NULL,
  last_value INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doc_type, period)
);
COMMENT ON TABLE document_counters IS 'Per-period sequence counters for document numbers (SO, RT, ...). Values only ever increase.';

-- Next value for a (doc_type, period); the row lock serialises concurrent callers.
CREATE OR REPLACE FUNCTION next_document_number(p_doc_type VARCHAR, p_period VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO document_counters (doc_type, period, last_value)
  VALUES (p_doc_type, p_period, 1)
  ON CONFLICT (doc_type, period)
  DO UPDATE SET last_value = document_counters.last_value + 1, updated_at = NOW()
  RETURNING last_value INTO v_next;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Seed today's SO counter from existing numbers so new orders continue the sequence.
INSERT INTO document_counters (doc_type, period, last_value)
SELECT 'SO', TO_CHAR((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD'),
       COALESCE(MAX(NULLIF(regexp_replace(order_number, '^SO-\d{8}-(\d+)$', '\1'), order_number)::INTEGER), 0)
FROM sales_orders
WHERE order_number LIKE 'SO-' || TO_CHAR((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD') || '-%'
ON CONFLICT (doc_type, period) DO UPDATE
  SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value);

-- Replaces the COUNT(*)+1 version from 017 (same trigger signature; format unchanged: SO-YYYYMMDD-NNNN,
-- business date in Vietnam time).
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TRIGGER AS $$
DECLARE
  v_period VARCHAR(8);
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    v_period := TO_CHAR((COALESCE(NEW.order_date, NOW()) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD');
    NEW.order_number := 'SO-' || v_period || '-' || LPAD(next_document_number('SO', v_period)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_sales_order_number ON sales_orders;
CREATE TRIGGER trg_generate_sales_order_number
BEFORE INSERT ON sales_orders
FOR EACH ROW
EXECUTE FUNCTION generate_sales_order_number();

-- The 006 trigger overwrote sales_orders.subtotal with SUM(line total) after every line insert,
-- which mixes line discounts and tax into "subtotal". Totals are now written by the server
-- (SalesPostingService) and must not be rewritten by the database.
DROP TRIGGER IF EXISTS trg_sales_order_items_totals ON sales_order_items;

-- =============================================
-- 2. sales_orders: shift link, idempotency, discount approval
-- =============================================
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS pos_session_id UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_request_id UUID,
  ADD COLUMN IF NOT EXISTS discount_approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_orders_client_request ON sales_orders(client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_orders_pos_session ON sales_orders(pos_session_id);

COMMENT ON COLUMN sales_orders.pos_session_id IS 'POS shift the sale was rung up in (channel = pos)';
COMMENT ON COLUMN sales_orders.client_request_id IS 'Idempotency key supplied by the POS client; a retry returns the existing order';
COMMENT ON COLUMN sales_orders.discount_approved_by IS 'User who approved a discount above the cashier''s role limit';

-- =============================================
-- 3. pos_sessions: store, closed_by, one open shift per user
-- =============================================
ALTER TABLE pos_sessions
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Backfill: a session's location is its store's default warehouse
UPDATE pos_sessions ps
SET store_id = s.id
FROM stores s
WHERE ps.store_id IS NULL AND s.default_warehouse_id = ps.location_id;

CREATE INDEX IF NOT EXISTS idx_pos_sessions_store ON pos_sessions(store_id);

-- Close duplicates before enforcing the rule: keep the most recent open shift per user
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY opened_at DESC) AS rn
  FROM pos_sessions WHERE status = 'open'
)
UPDATE pos_sessions ps
SET status = 'closed', closed_at = NOW(), notes = COALESCE(ps.notes || E'\n', '') || 'Closed by migration 021: duplicate open shift'
FROM ranked WHERE ranked.id = ps.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_sessions_one_open_per_user ON pos_sessions(user_id) WHERE status = 'open';

-- =============================================
-- 4. roles.max_discount_percent
-- =============================================
ALTER TABLE roles ADD COLUMN IF NOT EXISTS max_discount_percent NUMERIC(5, 2);
COMMENT ON COLUMN roles.max_discount_percent IS 'Largest discount (percent of the amount it applies to) a user with this role may give without approval; NULL = no limit';
UPDATE roles SET max_discount_percent = 10 WHERE name IN ('sales', 'sales_associate') AND max_discount_percent IS NULL;

-- =============================================
-- 5. POS permissions
-- =============================================
INSERT INTO permissions (name, resource, action, description) VALUES
  ('pos:approve', 'pos', 'approve', 'Approve POS discounts above the role limit'),
  ('pos:credit', 'pos', 'credit', 'Complete a POS sale with an unpaid balance (sale on credit)'),
  ('pos:supervise', 'pos', 'supervise', 'View and close other users'' POS shifts'),
  ('pos:reprint', 'pos', 'reprint', 'Reprint POS receipts')
ON CONFLICT (name) DO NOTHING;

-- Sales associate / sales: sell and run their own shift
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('sales_associate', 'sales') AND p.name IN ('pos:read', 'pos:create')
ON CONFLICT DO NOTHING;

-- Store manager / manager: everything on POS
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('store_manager', 'manager', 'superadmin') AND p.resource = 'pos'
ON CONFLICT DO NOTHING;

-- Finance: read shifts and sales
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'finance' AND p.name IN ('pos:read', 'pos:supervise')
ON CONFLICT DO NOTHING;

-- =============================================
-- 6. Inventory trigger: match the exact stock row
-- =============================================
-- Before: a variant movement that also carried product_id updated the base product's row too.
CREATE OR REPLACE FUNCTION update_inventory_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_delta INTEGER;
BEGIN
  IF NEW.transaction_type IN ('RECEIVE', 'ADJUST', 'RETURN', 'TRANSFER_IN') THEN
    v_delta := NEW.quantity;
  ELSIF NEW.transaction_type IN ('SALE', 'TRANSFER_OUT') THEN
    v_delta := -ABS(NEW.quantity);
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.product_variant_id IS NOT NULL THEN
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + v_delta, updated_at = NOW()
    WHERE location_id = NEW.location_id AND product_variant_id = NEW.product_variant_id;
  ELSE
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + v_delta, updated_at = NOW()
    WHERE location_id = NEW.location_id AND product_id = NEW.product_id AND product_variant_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
