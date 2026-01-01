-- Migration: Customer Loyalty Program
-- Description: Adds loyalty tiers, points, transactions, and configurable rules

-- 1. Loyalty Tiers - stores tier definitions
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  min_points INT NOT NULL DEFAULT 0,
  min_total_spend DECIMAL(12,2) DEFAULT 0,
  points_multiplier DECIMAL(5,2) DEFAULT 1.00,
  benefits JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_code ON loyalty_tiers(code);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_active ON loyalty_tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_order ON loyalty_tiers(display_order);

COMMENT ON TABLE loyalty_tiers IS 'Loyalty program tier definitions (Iron Rider, Silver Rider, Golden Legend)';

-- 2. Loyalty Rule Versions - versioned earning/redemption rules
CREATE TABLE IF NOT EXISTS loyalty_rule_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_number INT NOT NULL UNIQUE,

  -- Earning rules
  points_per_currency DECIMAL(10,6) NOT NULL,  -- e.g., 0.0001 = 1 point per 10,000 VND
  earning_round_mode VARCHAR(20) DEFAULT 'floor',

  -- Redemption rules
  redemption_rate DECIMAL(10,2) NOT NULL,  -- e.g., 1000 = 1 point = 1,000 VND
  max_redemption_percent DECIMAL(5,2) DEFAULT 50.00,
  min_redemption_points INT DEFAULT 100,

  -- Tier progression rules
  allow_tier_downgrade BOOLEAN DEFAULT false,
  tier_evaluation_basis VARCHAR(20) DEFAULT 'lifetime_points',  -- 'lifetime_points', 'total_spend'

  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rules_active ON loyalty_rule_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_rules_effective ON loyalty_rule_versions(effective_from, effective_to);

COMMENT ON TABLE loyalty_rule_versions IS 'Versioned loyalty program rules for earning and redemption';

-- 3. Customer Loyalty - each customer's loyalty state
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  current_tier_id UUID REFERENCES loyalty_tiers(id),

  -- Point balances
  points_balance INT NOT NULL DEFAULT 0,
  points_earned_lifetime INT NOT NULL DEFAULT 0,
  points_redeemed_lifetime INT NOT NULL DEFAULT 0,

  -- Spending totals (for tier evaluation)
  total_spend DECIMAL(12,2) DEFAULT 0,

  -- Timestamps
  tier_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_points_balance_non_negative CHECK (points_balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON customer_loyalty(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_tier ON customer_loyalty(current_tier_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_balance ON customer_loyalty(points_balance);

COMMENT ON TABLE customer_loyalty IS 'Customer loyalty status and point balances';

-- 4. Loyalty Point Transactions - immutable ledger of all point transactions
CREATE TABLE IF NOT EXISTS loyalty_point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,

  -- Transaction type: earn, redeem, reverse, adjust, expire
  transaction_type VARCHAR(20) NOT NULL,

  -- Points (positive for earn, negative for redeem/reverse)
  points INT NOT NULL,
  points_balance_after INT NOT NULL,

  -- Source reference
  reference_type VARCHAR(50),  -- 'sales_order', 'service_order', 'manual'
  reference_id UUID,

  -- Rule version used for this transaction
  rule_version_id UUID REFERENCES loyalty_rule_versions(id),

  -- Amount that generated/used these points
  order_amount DECIMAL(12,2),

  -- For reversals, link to original transaction
  reversed_transaction_id UUID REFERENCES loyalty_point_transactions(id),

  -- Audit
  reason TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_transaction_type CHECK (
    transaction_type IN ('earn', 'redeem', 'reverse', 'adjust', 'expire')
  )
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_point_transactions(customer_loyalty_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_type ON loyalty_point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_reference ON loyalty_point_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON loyalty_point_transactions(created_at DESC);

COMMENT ON TABLE loyalty_point_transactions IS 'Immutable ledger of all loyalty point transactions';

-- 5. Loyalty Tier History - audit log for tier changes
CREATE TABLE IF NOT EXISTS loyalty_tier_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,
  old_tier_id UUID REFERENCES loyalty_tiers(id),
  new_tier_id UUID REFERENCES loyalty_tiers(id),
  change_reason VARCHAR(100),  -- 'earned_points', 'spent_threshold', 'manual', 'downgrade'
  triggered_by_transaction_id UUID REFERENCES loyalty_point_transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_history_customer ON loyalty_tier_history(customer_loyalty_id);
CREATE INDEX IF NOT EXISTS idx_tier_history_created ON loyalty_tier_history(created_at DESC);

COMMENT ON TABLE loyalty_tier_history IS 'Audit log of customer tier changes';

-- 6. Add loyalty_discount_amount to sales_orders for tracking point redemptions
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned INT DEFAULT 0;

-- 7. Seed default tiers
INSERT INTO loyalty_tiers (code, name, display_order, min_points, points_multiplier, benefits)
VALUES
  ('iron', 'Iron Rider', 1, 0, 1.00, '{"description": "Thành viên cơ bản"}'),
  ('silver', 'Silver Rider', 2, 1000, 1.25, '{"description": "Tích lũy 25% điểm thưởng", "bonus_multiplier": 1.25}'),
  ('gold', 'Golden Legend', 3, 5000, 1.50, '{"description": "Tích lũy 50% điểm thưởng", "bonus_multiplier": 1.50}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  min_points = EXCLUDED.min_points,
  points_multiplier = EXCLUDED.points_multiplier,
  benefits = EXCLUDED.benefits,
  updated_at = NOW();

-- 8. Seed initial rule version
INSERT INTO loyalty_rule_versions (
  version_number,
  points_per_currency,
  earning_round_mode,
  redemption_rate,
  max_redemption_percent,
  min_redemption_points,
  allow_tier_downgrade,
  tier_evaluation_basis,
  is_active,
  effective_from,
  notes
) VALUES (
  1,
  0.0001,            -- 1 point per 10,000 VND
  'floor',
  1000,              -- 1 point = 1,000 VND
  50.00,             -- Max 50% of order can be paid with points
  100,               -- Minimum 100 points to redeem
  false,             -- No tier downgrade
  'lifetime_points',
  true,
  NOW(),
  'Initial loyalty program rules: 1 point per 10,000 VND spent, 1 point = 1,000 VND redemption'
)
ON CONFLICT (version_number) DO NOTHING;

-- 9. Function to auto-create customer_loyalty record
CREATE OR REPLACE FUNCTION ensure_customer_loyalty()
RETURNS TRIGGER AS $$
DECLARE
  default_tier_id UUID;
BEGIN
  -- Get the default (lowest) tier
  SELECT id INTO default_tier_id FROM loyalty_tiers
  WHERE is_active = true
  ORDER BY min_points ASC
  LIMIT 1;

  -- Create loyalty record if it doesn't exist
  INSERT INTO customer_loyalty (customer_id, current_tier_id)
  VALUES (NEW.id, default_tier_id)
  ON CONFLICT (customer_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new customers
DROP TRIGGER IF EXISTS trg_ensure_customer_loyalty ON customers;
CREATE TRIGGER trg_ensure_customer_loyalty
AFTER INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION ensure_customer_loyalty();

-- 10. Create loyalty records for existing customers
INSERT INTO customer_loyalty (customer_id, current_tier_id)
SELECT c.id, (SELECT id FROM loyalty_tiers WHERE is_active = true ORDER BY min_points ASC LIMIT 1)
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM customer_loyalty cl WHERE cl.customer_id = c.id
)
ON CONFLICT (customer_id) DO NOTHING;

-- 11. Function to update customer_loyalty.updated_at
CREATE OR REPLACE FUNCTION update_customer_loyalty_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_loyalty_updated ON customer_loyalty;
CREATE TRIGGER trg_customer_loyalty_updated
BEFORE UPDATE ON customer_loyalty
FOR EACH ROW
EXECUTE FUNCTION update_customer_loyalty_timestamp();
