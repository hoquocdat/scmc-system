-- Rollback of 028_qr_payments.sql
BEGIN;
DROP INDEX IF EXISTS uq_sales_order_payments_qr;
ALTER TABLE sales_order_payments DROP COLUMN IF EXISTS qr_payment_request_id;
DROP TABLE IF EXISTS qr_payment_events;
DROP TABLE IF EXISTS qr_payment_requests;
DROP TABLE IF EXISTS qr_provider_settings;
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE resource = 'qr_payments');
DELETE FROM permissions WHERE resource = 'qr_payments';
COMMIT;
