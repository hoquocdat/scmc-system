-- 028: QR payments (change ewallet-qr-payments, design D1)
BEGIN;

CREATE TABLE qr_provider_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider        VARCHAR(10) NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  secrets         TEXT,
  cash_account_id UUID REFERENCES cash_book_accounts(id),
  updated_by      UUID REFERENCES user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_qr_provider_settings_provider CHECK (provider IN ('vietqr', 'momo', 'zalopay', 'vnpay')),
  CONSTRAINT uq_qr_provider_settings UNIQUE (store_id, provider)
);

CREATE TABLE qr_payment_requests (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                   VARCHAR(20) NOT NULL UNIQUE,
  store_id               UUID NOT NULL REFERENCES stores(id),
  pos_session_id         UUID REFERENCES pos_sessions(id),
  provider               VARCHAR(10) NOT NULL,
  method                 VARCHAR(20) NOT NULL,
  amount                 NUMERIC(14, 2) NOT NULL,
  status                 VARCHAR(10) NOT NULL DEFAULT 'pending',
  qr_content             TEXT,
  pay_url                TEXT,
  provider_ref           VARCHAR(100),
  client_request_id      UUID,
  sales_order_id         UUID REFERENCES sales_orders(id),
  sales_order_payment_id UUID REFERENCES sales_order_payments(id),
  expires_at             TIMESTAMPTZ NOT NULL,
  paid_at                TIMESTAMPTZ,
  confirmed_by           UUID REFERENCES user_profiles(id),
  failure_reason         TEXT,
  created_by             UUID REFERENCES user_profiles(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_qr_payment_requests_provider CHECK (provider IN ('vietqr', 'momo', 'zalopay', 'vnpay')),
  CONSTRAINT chk_qr_payment_requests_method CHECK (method IN ('bank_transfer', 'ewallet_momo', 'ewallet_zalopay', 'ewallet_vnpay')),
  CONSTRAINT chk_qr_payment_requests_status CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled')),
  CONSTRAINT chk_qr_payment_requests_amount CHECK (amount > 0)
);
CREATE INDEX idx_qr_payment_requests_store_status ON qr_payment_requests(store_id, status, created_at);
CREATE UNIQUE INDEX uq_qr_payment_requests_order ON qr_payment_requests(sales_order_payment_id) WHERE sales_order_payment_id IS NOT NULL;

CREATE TABLE qr_payment_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id   UUID REFERENCES qr_payment_requests(id) ON DELETE SET NULL,
  provider     VARCHAR(10) NOT NULL,
  kind         VARCHAR(20) NOT NULL,
  signature_ok BOOLEAN,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by   UUID REFERENCES user_profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_qr_payment_events_kind CHECK (kind IN ('create', 'callback', 'query', 'manual_confirm', 'webhook', 'cancel', 'expire'))
);
CREATE INDEX idx_qr_payment_events_request ON qr_payment_events(request_id, created_at);

ALTER TABLE sales_order_payments ADD COLUMN qr_payment_request_id UUID REFERENCES qr_payment_requests(id);
CREATE UNIQUE INDEX uq_sales_order_payments_qr ON sales_order_payments(qr_payment_request_id) WHERE qr_payment_request_id IS NOT NULL;

INSERT INTO permissions (name, resource, action, description) VALUES
  ('qr_payments:create',    'qr_payments', 'create',    'Create QR payment requests at the counter'),
  ('qr_payments:confirm',   'qr_payments', 'confirm',   'Confirm received VietQR transfers'),
  ('qr_payments:configure', 'qr_payments', 'configure', 'Manage QR payment providers and credentials')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('manager', 'superadmin') AND p.resource = 'qr_payments'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('store_manager', 'sales', 'sales_associate') AND p.name IN ('qr_payments:create', 'qr_payments:confirm')
ON CONFLICT DO NOTHING;

COMMIT;
