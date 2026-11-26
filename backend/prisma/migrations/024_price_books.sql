-- 024: price books (bảng giá) and customer groups (change price-books, design D1)
BEGIN;

-- =============================================
-- 1. Customer groups
-- =============================================
CREATE TABLE customer_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(30)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES user_profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_group_members (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES customer_groups(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, group_id)
);
CREATE INDEX idx_customer_group_members_group ON customer_group_members(group_id);

-- =============================================
-- 2. Price books
-- =============================================
CREATE TABLE price_books (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          VARCHAR(30)  NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  priority      INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  start_at      TIMESTAMPTZ,
  end_at        TIMESTAMPTZ,
  all_stores    BOOLEAN NOT NULL DEFAULT true,
  all_customers BOOLEAN NOT NULL DEFAULT true,
  allow_manual  BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_by    UUID REFERENCES user_profiles(id),
  updated_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_price_books_dates CHECK (start_at IS NULL OR end_at IS NULL OR end_at >= start_at)
);

CREATE TABLE price_book_stores (
  price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  PRIMARY KEY (price_book_id, store_id)
);

CREATE TABLE price_book_customer_groups (
  price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES customer_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (price_book_id, group_id)
);
CREATE INDEX idx_price_book_customer_groups_group ON price_book_customer_groups(group_id);

CREATE TABLE price_book_entries (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_book_id      UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  mode               VARCHAR(20) NOT NULL,
  value              NUMERIC(12, 2) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_price_book_entries_mode CHECK (mode IN ('fixed', 'percent_off', 'amount_off')),
  CONSTRAINT chk_price_book_entries_value CHECK (value >= 0 AND (mode <> 'percent_off' OR value <= 100))
);
CREATE UNIQUE INDEX uq_price_book_entries_product
  ON price_book_entries(price_book_id, product_id) WHERE product_variant_id IS NULL;
CREATE UNIQUE INDEX uq_price_book_entries_variant
  ON price_book_entries(price_book_id, product_variant_id) WHERE product_variant_id IS NOT NULL;
CREATE INDEX idx_price_book_entries_product ON price_book_entries(product_id);
CREATE INDEX idx_price_book_entries_variant ON price_book_entries(product_variant_id);

-- =============================================
-- 3. Price source on orders
-- =============================================
ALTER TABLE sales_order_items
  ADD COLUMN price_book_id   UUID REFERENCES price_books(id) ON DELETE SET NULL,
  ADD COLUMN base_unit_price NUMERIC(12, 2),
  ADD COLUMN price_source    VARCHAR(30);
CREATE INDEX idx_sales_order_items_price_book ON sales_order_items(price_book_id);

ALTER TABLE sales_orders
  ADD COLUMN price_book_id UUID REFERENCES price_books(id) ON DELETE SET NULL;

-- =============================================
-- 4. Permissions (D1)
-- =============================================
INSERT INTO permissions (name, resource, action, description) VALUES
  ('price_books:read',       'price_books',     'read',   'View price books and price quotes'),
  ('price_books:create',     'price_books',     'create', 'Create price books'),
  ('price_books:update',     'price_books',     'update', 'Edit price books and their entries'),
  ('price_books:delete',     'price_books',     'delete', 'Delete price books'),
  ('price_books:apply',      'price_books',     'apply',  'Choose a price book for a sale'),
  ('customer_groups:read',   'customer_groups', 'read',   'View customer groups'),
  ('customer_groups:create', 'customer_groups', 'create', 'Create customer groups'),
  ('customer_groups:update', 'customer_groups', 'update', 'Edit customer groups and memberships'),
  ('customer_groups:delete', 'customer_groups', 'delete', 'Delete customer groups')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('manager', 'superadmin') AND p.resource IN ('price_books', 'customer_groups')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'store_manager'
  AND p.name IN ('price_books:read', 'price_books:apply', 'customer_groups:read', 'customer_groups:create', 'customer_groups:update')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('finance', 'sales', 'sales_associate') AND p.name IN ('price_books:read', 'customer_groups:read')
ON CONFLICT DO NOTHING;

COMMIT;
