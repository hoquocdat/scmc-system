-- Migration: Cash book (sổ quỹ)
-- Design: openspec/changes/cash-book/design.md (D1, D4, D5, D9)
--
--   1. Accounts per branch (one POS drawer each), payment-method mapping
--   2. Categories (system + examples)
--   3. Entries (receipts / payments, PT / PC numbers)
--   4. image_entity_type value for voucher attachments
--   5. Default accounts and mappings for existing stores
--   6. Permissions and grants
--   7. Move pos_session_transactions into drawer entries
--
-- Rollback: prisma/migrations/rollback/023_cash_book.sql

-- =============================================
-- 1. Accounts and method mapping
-- =============================================
CREATE TABLE IF NOT EXISTS cash_book_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  code           VARCHAR(30) NOT NULL UNIQUE,
  name           VARCHAR(150) NOT NULL,
  type           VARCHAR(10) NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet')),
  is_pos_drawer  BOOLEAN NOT NULL DEFAULT false,
  bank_name      VARCHAR(150),
  account_number VARCHAR(50),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cash_book_drawer_is_cash CHECK (NOT is_pos_drawer OR type = 'cash')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_book_accounts_drawer ON cash_book_accounts(store_id) WHERE is_pos_drawer;
CREATE INDEX IF NOT EXISTS idx_cash_book_accounts_store ON cash_book_accounts(store_id);

CREATE TABLE IF NOT EXISTS cash_book_method_accounts (
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'ewallet_momo', 'ewallet_zalopay', 'ewallet_vnpay')),
  account_id     UUID NOT NULL REFERENCES cash_book_accounts(id) ON DELETE RESTRICT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, payment_method)
);

-- =============================================
-- 2. Categories
-- =============================================
CREATE TABLE IF NOT EXISTS cash_book_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) NOT NULL,
  name       VARCHAR(100) NOT NULL,
  direction  VARCHAR(3) NOT NULL CHECK (direction IN ('in', 'out')),
  is_system  BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, direction)
);

INSERT INTO cash_book_categories (code, name, direction, is_system) VALUES
  ('sale',                  'Bán hàng',               'in',  true),
  ('receivable_collection', 'Thu nợ khách hàng',      'in',  true),
  ('workshop_service',      'Dịch vụ xưởng',          'in',  true),
  ('shift_cash_in',         'Nộp tiền vào quầy',      'in',  true),
  ('opening_balance',       'Số dư đầu kỳ',           'in',  true),
  ('transfer_in',           'Chuyển quỹ đến',         'in',  true),
  ('cash_count_difference', 'Chênh lệch kiểm quỹ',    'in',  true),
  ('reversal',              'Điều chỉnh đảo',         'in',  true),
  ('other_income',          'Thu khác',               'in',  true),
  ('supplier_payment',      'Trả nhà cung cấp',       'out', true),
  ('payroll',               'Lương nhân viên',        'out', true),
  ('shift_cash_out',        'Rút tiền khỏi quầy',     'out', true),
  ('transfer_out',          'Chuyển quỹ đi',          'out', true),
  ('cash_count_difference', 'Chênh lệch kiểm quỹ',    'out', true),
  ('reversal',              'Điều chỉnh đảo',         'out', true),
  ('other_expense',         'Chi khác',               'out', true),
  ('rent',                  'Thuê mặt bằng',          'out', false),
  ('utilities',             'Điện nước',              'out', false),
  ('shipping',              'Vận chuyển',             'out', false),
  ('maintenance',           'Sửa chữa, bảo trì',      'out', false)
ON CONFLICT (code, direction) DO NOTHING;

-- =============================================
-- 3. Entries
-- =============================================
CREATE TABLE IF NOT EXISTS cash_book_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number      VARCHAR(30) NOT NULL UNIQUE,
  account_id        UUID NOT NULL REFERENCES cash_book_accounts(id) ON DELETE RESTRICT,
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  direction         VARCHAR(3) NOT NULL CHECK (direction IN ('in', 'out')),
  amount            NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  entry_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category_id       UUID NOT NULL REFERENCES cash_book_categories(id) ON DELETE RESTRICT,
  counterparty_type VARCHAR(10) CHECK (counterparty_type IN ('customer', 'supplier', 'employee', 'other')),
  counterparty_id   UUID,
  counterparty_name VARCHAR(200),
  source_type       VARCHAR(40),
  source_id         UUID,
  pos_session_id    UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,
  transfer_group_id UUID,
  reverses_entry_id UUID REFERENCES cash_book_entries(id) ON DELETE RESTRICT,
  is_automatic      BOOLEAN NOT NULL DEFAULT false,
  is_opening        BOOLEAN NOT NULL DEFAULT false,
  status            VARCHAR(10) NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled')),
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  cancel_reason     TEXT,
  note              TEXT,
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_book_entries_account_date ON cash_book_entries(account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_cash_book_entries_store_date ON cash_book_entries(store_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_cash_book_entries_source ON cash_book_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_cash_book_entries_session ON cash_book_entries(pos_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_book_entries_transfer ON cash_book_entries(transfer_group_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_book_entries_opening ON cash_book_entries(account_id) WHERE is_opening AND status = 'posted';

COMMENT ON TABLE cash_book_entries IS 'Sổ quỹ: every receipt (in) and payment (out) per cash/bank/e-wallet account';

-- =============================================
-- 4. Attachments
-- =============================================
ALTER TYPE image_entity_type ADD VALUE IF NOT EXISTS 'cash_book_entry';

-- =============================================
-- 5. Default accounts and mappings for existing stores
-- =============================================
INSERT INTO cash_book_accounts (store_id, code, name, type, is_pos_drawer)
SELECT s.id, s.code || '-CASH', 'Tiền mặt quầy ' || s.name, 'cash', true
FROM stores s
WHERE NOT EXISTS (SELECT 1 FROM cash_book_accounts a WHERE a.store_id = s.id AND a.is_pos_drawer)
ON CONFLICT (code) DO NOTHING;

INSERT INTO cash_book_accounts (store_id, code, name, type)
SELECT s.id, s.code || '-BANK', 'Ngân hàng ' || s.name, 'bank'
FROM stores s
WHERE NOT EXISTS (SELECT 1 FROM cash_book_accounts a WHERE a.store_id = s.id AND a.type = 'bank')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cash_book_method_accounts (store_id, payment_method, account_id)
SELECT s.id, m.method,
       CASE WHEN m.method = 'cash'
            THEN (SELECT id FROM cash_book_accounts WHERE store_id = s.id AND is_pos_drawer)
            ELSE (SELECT id FROM cash_book_accounts WHERE store_id = s.id AND type = 'bank' ORDER BY created_at LIMIT 1)
       END
FROM stores s
CROSS JOIN (VALUES ('cash'), ('card'), ('bank_transfer'), ('ewallet_momo'), ('ewallet_zalopay'), ('ewallet_vnpay')) AS m(method)
ON CONFLICT (store_id, payment_method) DO NOTHING;

-- =============================================
-- 6. Permissions
-- =============================================
INSERT INTO permissions (name, resource, action, description) VALUES
  ('cash_book:read',      'cash_book', 'read',      'View the cash book, accounts and balances'),
  ('cash_book:receive',   'cash_book', 'receive',   'Record receipt vouchers (phiếu thu)'),
  ('cash_book:pay',       'cash_book', 'pay',       'Record payment vouchers (phiếu chi)'),
  ('cash_book:transfer',  'cash_book', 'transfer',  'Transfer money between cash book accounts'),
  ('cash_book:cancel',    'cash_book', 'cancel',    'Cancel manual vouchers, transfers and opening balances'),
  ('cash_book:configure', 'cash_book', 'configure', 'Manage accounts, method mapping, categories and opening balances')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('finance', 'manager', 'superadmin') AND p.resource = 'cash_book'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'store_manager' AND p.name IN ('cash_book:read', 'cash_book:receive', 'cash_book:transfer')
ON CONFLICT DO NOTHING;

-- =============================================
-- 7. Shift cash movements -> drawer entries
-- =============================================
-- Each pos_session_transactions row becomes an automatic entry on the shift's
-- store drawer. The old table is kept (read-only) for rollback.
INSERT INTO cash_book_entries (
  entry_number, account_id, store_id, direction, amount, entry_date, category_id,
  source_type, source_id, pos_session_id, is_automatic, note, created_by, created_at
)
SELECT
  CASE WHEN t.amount >= 0 THEN 'PT' ELSE 'PC' END || '-' ||
    TO_CHAR((COALESCE(t.created_at, NOW()) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD') || '-' ||
    LPAD(next_document_number(CASE WHEN t.amount >= 0 THEN 'PT' ELSE 'PC' END,
         TO_CHAR((COALESCE(t.created_at, NOW()) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD'))::text, 4, '0'),
  a.id, ps.store_id,
  CASE WHEN t.amount >= 0 THEN 'in' ELSE 'out' END,
  ABS(t.amount),
  COALESCE(t.created_at, NOW()),
  (SELECT id FROM cash_book_categories WHERE code = CASE WHEN t.amount >= 0 THEN 'shift_cash_in' ELSE 'shift_cash_out' END
                                         AND direction = CASE WHEN t.amount >= 0 THEN 'in' ELSE 'out' END),
  'pos_session_transaction', t.id, t.pos_session_id, true,
  NULLIF(CONCAT_WS(' - ', t.reason, t.notes), ''),
  ps.user_id,
  COALESCE(t.created_at, NOW())
FROM pos_session_transactions t
JOIN pos_sessions ps ON ps.id = t.pos_session_id
JOIN cash_book_accounts a ON a.store_id = ps.store_id AND a.is_pos_drawer
WHERE t.amount <> 0
  AND t.transaction_type IN ('cash_in', 'cash_out')
  AND NOT EXISTS (SELECT 1 FROM cash_book_entries e WHERE e.source_type = 'pos_session_transaction' AND e.source_id = t.id);

COMMENT ON TABLE pos_session_transactions IS 'Legacy (read-only since 023_cash_book): shift cash movements now live in cash_book_entries';
