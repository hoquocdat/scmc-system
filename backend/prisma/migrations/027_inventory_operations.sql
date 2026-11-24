-- 027: inventory operations (change inventory-operations, design D1)
BEGIN;

-- =============================================
-- 1. Transfers (existing tables)
-- =============================================
ALTER TABLE transfer_orders
  ADD COLUMN cancelled_at  TIMESTAMPTZ,
  ADD COLUMN cancelled_by  UUID REFERENCES user_profiles(id),
  ADD COLUMN cancel_reason TEXT;
UPDATE transfer_orders SET status = 'pending' WHERE status IS NULL OR status NOT IN ('pending', 'in_transit', 'partially_received', 'received', 'cancelled');
ALTER TABLE transfer_orders
  ALTER COLUMN status SET NOT NULL,
  ADD CONSTRAINT chk_transfer_orders_status CHECK (status IN ('pending', 'in_transit', 'partially_received', 'received', 'cancelled'));

ALTER TABLE transfer_order_items
  ADD COLUMN quantity_discrepancy INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN unit_cost NUMERIC(12, 2),
  ADD CONSTRAINT chk_transfer_order_items_qty CHECK (
    quantity_requested > 0
    AND COALESCE(quantity_shipped, 0) >= 0
    AND COALESCE(quantity_received, 0) >= 0
    AND COALESCE(quantity_received, 0) <= GREATEST(COALESCE(quantity_shipped, 0), 0)),
  ADD CONSTRAINT chk_transfer_order_items_item CHECK ((product_id IS NULL) <> (product_variant_id IS NULL));

-- =============================================
-- 2. Stock counts
-- =============================================
CREATE TABLE stock_counts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_number VARCHAR(30) NOT NULL UNIQUE,
  location_id  UUID NOT NULL REFERENCES stock_locations(id),
  status       VARCHAR(12) NOT NULL DEFAULT 'counting',
  scope        JSONB NOT NULL DEFAULT '{}'::jsonb,
  note         TEXT,
  created_by   UUID REFERENCES user_profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  CONSTRAINT chk_stock_counts_status CHECK (status IN ('counting', 'completed', 'cancelled'))
);
CREATE UNIQUE INDEX uq_stock_counts_open_location ON stock_counts(location_id) WHERE status = 'counting';

CREATE TABLE stock_count_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_count_id     UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES products(id),
  product_variant_id UUID REFERENCES product_variants(id),
  system_quantity    INTEGER NOT NULL,
  counted_quantity   INTEGER,
  system_at_count    INTEGER,
  counted_at         TIMESTAMPTZ,
  counted_by         UUID REFERENCES user_profiles(id),
  unit_cost          NUMERIC(12, 2),
  adjustment         INTEGER,
  CONSTRAINT chk_stock_count_items_item CHECK ((product_id IS NULL) <> (product_variant_id IS NULL)),
  CONSTRAINT chk_stock_count_items_counted CHECK (counted_quantity IS NULL OR counted_quantity >= 0)
);
CREATE UNIQUE INDEX uq_stock_count_items_product ON stock_count_items(stock_count_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX uq_stock_count_items_variant ON stock_count_items(stock_count_id, product_variant_id) WHERE product_variant_id IS NOT NULL;

-- =============================================
-- 3. Write-offs
-- =============================================
CREATE TABLE stock_write_offs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  write_off_number VARCHAR(30) NOT NULL UNIQUE,
  location_id      UUID NOT NULL REFERENCES stock_locations(id),
  reason           VARCHAR(20) NOT NULL,
  note             TEXT,
  total_cost       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES user_profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_stock_write_offs_reason CHECK (reason IN ('damaged', 'lost', 'internal_use', 'expired', 'other'))
);
CREATE INDEX idx_stock_write_offs_location_date ON stock_write_offs(location_id, created_at);

CREATE TABLE stock_write_off_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  write_off_id       UUID NOT NULL REFERENCES stock_write_offs(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES products(id),
  product_variant_id UUID REFERENCES product_variants(id),
  quantity           INTEGER NOT NULL,
  unit_cost          NUMERIC(12, 2),
  CONSTRAINT chk_stock_write_off_items_item CHECK ((product_id IS NULL) <> (product_variant_id IS NULL)),
  CONSTRAINT chk_stock_write_off_items_qty CHECK (quantity > 0)
);

-- =============================================
-- 4. Barcodes and units
-- =============================================
ALTER TABLE products
  ADD COLUMN barcode   VARCHAR(64),
  ADD COLUMN base_unit VARCHAR(30) NOT NULL DEFAULT 'cái';
ALTER TABLE product_variants ADD COLUMN barcode VARCHAR(64);
CREATE UNIQUE INDEX uq_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX uq_product_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;

CREATE TABLE product_units (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       VARCHAR(30) NOT NULL,
  factor     INTEGER NOT NULL,
  barcode    VARCHAR(64),
  price      NUMERIC(12, 2),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_units_factor CHECK (factor > 1),
  CONSTRAINT chk_product_units_price CHECK (price IS NULL OR price >= 0),
  CONSTRAINT uq_product_units_name UNIQUE (product_id, name)
);
CREATE UNIQUE INDEX uq_product_units_barcode ON product_units(barcode) WHERE barcode IS NOT NULL;

ALTER TABLE sales_order_items
  ADD COLUMN unit_name   VARCHAR(30),
  ADD COLUMN unit_factor INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT chk_sales_order_items_unit_factor CHECK (unit_factor >= 1);
ALTER TABLE purchase_order_items
  ADD COLUMN unit_name   VARCHAR(30),
  ADD COLUMN unit_factor INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT chk_purchase_order_items_unit_factor CHECK (unit_factor >= 1);

-- Internal EAN-13 sequence (prefix 20)
CREATE SEQUENCE IF NOT EXISTS barcode_seq START 1;

-- =============================================
-- 5. Stock trigger: WRITE_OFF subtracts; TRANSFER_LOSS / RETURN_DAMAGED are records only
-- =============================================
CREATE OR REPLACE FUNCTION update_inventory_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_delta INTEGER;
BEGIN
  IF NEW.transaction_type IN ('RECEIVE', 'ADJUST', 'RETURN', 'TRANSFER_IN') THEN
    v_delta := NEW.quantity;
  ELSIF NEW.transaction_type IN ('SALE', 'TRANSFER_OUT', 'WRITE_OFF') THEN
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

-- =============================================
-- 6. Permissions
-- =============================================
INSERT INTO permissions (name, resource, action, description) VALUES
  ('inventory:write_off',     'inventory', 'write_off',     'Write off damaged, lost or used stock'),
  ('inventory:count',         'inventory', 'count',         'Start and enter stock counts'),
  ('inventory:approve_count', 'inventory', 'approve_count', 'Complete stock counts and post their adjustments'),
  ('inventory:labels',        'inventory', 'labels',        'Print barcode labels'),
  ('inventory:transfer',      'inventory', 'transfer',      'Create, ship and receive stock transfers')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('manager', 'superadmin', 'store_manager')
  AND p.name IN ('inventory:read', 'inventory:adjust', 'inventory:transfer', 'inventory:write_off', 'inventory:count', 'inventory:approve_count', 'inventory:labels')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'warehouse_staff' AND p.name IN ('inventory:read', 'inventory:count', 'inventory:transfer', 'inventory:labels')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('sales', 'sales_associate', 'finance') AND p.name IN ('inventory:read', 'inventory:labels')
ON CONFLICT DO NOTHING;

COMMIT;
