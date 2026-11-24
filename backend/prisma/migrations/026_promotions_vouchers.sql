-- 026: promotions and vouchers (change promotions-vouchers, design D1)
BEGIN;

-- =============================================
-- 1. Promotions
-- =============================================
CREATE TABLE promotions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                 VARCHAR(30)  NOT NULL UNIQUE,
  name                 VARCHAR(150) NOT NULL,
  type                 VARCHAR(20)  NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  priority             INTEGER NOT NULL DEFAULT 0,
  start_at             TIMESTAMPTZ,
  end_at               TIMESTAMPTZ,
  days_of_week         SMALLINT[],
  time_from            TIME,
  time_to              TIME,
  all_stores           BOOLEAN NOT NULL DEFAULT true,
  all_customers        BOOLEAN NOT NULL DEFAULT true,
  channels             TEXT[],
  combinable           BOOLEAN NOT NULL DEFAULT true,
  discount_kind        VARCHAR(20),
  discount_value       NUMERIC(14, 2),
  max_discount         NUMERIC(14, 2),
  min_order_amount     NUMERIC(14, 2),
  buy_quantity         INTEGER,
  get_quantity         INTEGER,
  get_discount_percent NUMERIC(5, 2),
  bundle_price         NUMERIC(14, 2),
  notes                TEXT,
  created_by           UUID REFERENCES user_profiles(id),
  updated_by           UUID REFERENCES user_profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_promotions_type CHECK (type IN ('line_discount', 'order_discount', 'buy_x_get_y', 'bundle')),
  CONSTRAINT chk_promotions_dates CHECK (start_at IS NULL OR end_at IS NULL OR end_at >= start_at),
  CONSTRAINT chk_promotions_kind CHECK (discount_kind IS NULL OR discount_kind IN ('percent', 'amount', 'fixed_price')),
  CONSTRAINT chk_promotions_values CHECK (
    (discount_value IS NULL OR discount_value >= 0)
    AND (discount_kind IS DISTINCT FROM 'percent' OR discount_value <= 100)
    AND (max_discount IS NULL OR max_discount >= 0)
    AND (min_order_amount IS NULL OR min_order_amount >= 0)
    AND (buy_quantity IS NULL OR buy_quantity > 0)
    AND (get_quantity IS NULL OR get_quantity > 0)
    AND (get_discount_percent IS NULL OR (get_discount_percent > 0 AND get_discount_percent <= 100))
    AND (bundle_price IS NULL OR bundle_price >= 0)),
  CONSTRAINT chk_promotions_shape CHECK (
    (type = 'line_discount' AND discount_kind IS NOT NULL AND discount_value IS NOT NULL)
    OR (type = 'order_discount' AND discount_kind IN ('percent', 'amount') AND discount_value IS NOT NULL)
    OR (type = 'buy_x_get_y' AND buy_quantity IS NOT NULL AND get_quantity IS NOT NULL AND get_discount_percent IS NOT NULL)
    OR (type = 'bundle' AND bundle_price IS NOT NULL))
);
CREATE INDEX idx_promotions_active ON promotions(is_active, start_at, end_at);

CREATE TABLE promotion_targets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  role         VARCHAR(10) NOT NULL DEFAULT 'target',
  target_type  VARCHAR(10) NOT NULL,
  target_id    UUID NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT chk_promotion_targets_role CHECK (role IN ('target', 'buy', 'get', 'bundle')),
  CONSTRAINT chk_promotion_targets_type CHECK (target_type IN ('product', 'variant', 'category', 'brand')),
  CONSTRAINT chk_promotion_targets_qty CHECK (quantity > 0)
);
CREATE INDEX idx_promotion_targets_promotion ON promotion_targets(promotion_id);

CREATE TABLE promotion_stores (
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, store_id)
);

CREATE TABLE promotion_customer_groups (
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  group_id     UUID NOT NULL REFERENCES customer_groups(id) ON DELETE RESTRICT,
  PRIMARY KEY (promotion_id, group_id)
);

-- =============================================
-- 2. Vouchers
-- =============================================
CREATE TABLE voucher_campaigns (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                       VARCHAR(30)  NOT NULL UNIQUE,
  name                       VARCHAR(150) NOT NULL,
  discount_kind              VARCHAR(10)  NOT NULL,
  discount_value             NUMERIC(14, 2) NOT NULL,
  max_discount               NUMERIC(14, 2),
  min_order_amount           NUMERIC(14, 2),
  start_at                   TIMESTAMPTZ,
  end_at                     TIMESTAMPTZ,
  all_stores                 BOOLEAN NOT NULL DEFAULT true,
  channels                   TEXT[],
  uses_per_code              INTEGER NOT NULL DEFAULT 1,
  uses_per_customer          INTEGER,
  combinable_with_promotions BOOLEAN NOT NULL DEFAULT true,
  is_active                  BOOLEAN NOT NULL DEFAULT true,
  notes                      TEXT,
  created_by                 UUID REFERENCES user_profiles(id),
  updated_by                 UUID REFERENCES user_profiles(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_voucher_campaigns_kind CHECK (discount_kind IN ('percent', 'amount')),
  CONSTRAINT chk_voucher_campaigns_value CHECK (discount_value > 0 AND (discount_kind <> 'percent' OR discount_value <= 100)),
  CONSTRAINT chk_voucher_campaigns_limits CHECK (uses_per_code > 0 AND (uses_per_customer IS NULL OR uses_per_customer > 0)),
  CONSTRAINT chk_voucher_campaigns_dates CHECK (start_at IS NULL OR end_at IS NULL OR end_at >= start_at)
);

CREATE TABLE voucher_campaign_stores (
  campaign_id UUID NOT NULL REFERENCES voucher_campaigns(id) ON DELETE CASCADE,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, store_id)
);

CREATE TABLE vouchers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES voucher_campaigns(id) ON DELETE CASCADE,
  code        VARCHAR(40) NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  used_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_vouchers_code_upper CHECK (code = upper(code)),
  CONSTRAINT chk_vouchers_used CHECK (used_count >= 0)
);
CREATE INDEX idx_vouchers_campaign ON vouchers(campaign_id);

CREATE TABLE voucher_redemptions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id     UUID NOT NULL REFERENCES vouchers(id),
  campaign_id    UUID NOT NULL REFERENCES voucher_campaigns(id),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
  customer_id    UUID REFERENCES customers(id),
  amount         NUMERIC(14, 2) NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'applied',
  released_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_voucher_redemptions_status CHECK (status IN ('applied', 'released')),
  CONSTRAINT uq_voucher_redemptions_order UNIQUE (voucher_id, sales_order_id)
);
CREATE INDEX idx_voucher_redemptions_customer ON voucher_redemptions(campaign_id, customer_id, status);

-- =============================================
-- 3. Applied discounts on orders
-- =============================================
CREATE TABLE sales_order_discounts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id      UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE CASCADE,
  source_type         VARCHAR(10) NOT NULL,
  promotion_id        UUID REFERENCES promotions(id) ON DELETE SET NULL,
  voucher_id          UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  amount              NUMERIC(14, 2) NOT NULL,
  description         VARCHAR(255),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sales_order_discounts_source CHECK (source_type IN ('promotion', 'voucher')),
  CONSTRAINT chk_sales_order_discounts_amount CHECK (amount > 0)
);
CREATE INDEX idx_sales_order_discounts_order ON sales_order_discounts(sales_order_id);
CREATE INDEX idx_sales_order_discounts_promotion ON sales_order_discounts(promotion_id);
CREATE INDEX idx_sales_order_discounts_voucher ON sales_order_discounts(voucher_id);

ALTER TABLE sales_order_items ADD COLUMN promotion_discount NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE sales_orders
  ADD COLUMN promotion_discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN voucher_discount_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN voucher_code              VARCHAR(40);

-- =============================================
-- 4. Permissions
-- =============================================
INSERT INTO permissions (name, resource, action, description) VALUES
  ('promotions:read',   'promotions', 'read',   'View promotions and their usage'),
  ('promotions:create', 'promotions', 'create', 'Create promotions'),
  ('promotions:update', 'promotions', 'update', 'Edit, activate and deactivate promotions'),
  ('promotions:delete', 'promotions', 'delete', 'Delete promotions'),
  ('vouchers:read',     'vouchers',   'read',   'View voucher campaigns, codes and usage'),
  ('vouchers:create',   'vouchers',   'create', 'Create voucher campaigns and codes'),
  ('vouchers:update',   'vouchers',   'update', 'Edit voucher campaigns and codes'),
  ('vouchers:delete',   'vouchers',   'delete', 'Delete voucher campaigns')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('manager', 'superadmin') AND p.resource IN ('promotions', 'vouchers')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('store_manager', 'finance', 'sales', 'sales_associate')
  AND p.name IN ('promotions:read', 'vouchers:read')
ON CONFLICT DO NOTHING;

COMMIT;
