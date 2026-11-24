-- Rollback of 026_promotions_vouchers.sql
BEGIN;

ALTER TABLE sales_orders
  DROP COLUMN IF EXISTS voucher_code,
  DROP COLUMN IF EXISTS voucher_discount_amount,
  DROP COLUMN IF EXISTS promotion_discount_amount;
ALTER TABLE sales_order_items DROP COLUMN IF EXISTS promotion_discount;

DROP TABLE IF EXISTS sales_order_discounts;
DROP TABLE IF EXISTS voucher_redemptions;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS voucher_campaign_stores;
DROP TABLE IF EXISTS voucher_campaigns;
DROP TABLE IF EXISTS promotion_customer_groups;
DROP TABLE IF EXISTS promotion_stores;
DROP TABLE IF EXISTS promotion_targets;
DROP TABLE IF EXISTS promotions;

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE resource IN ('promotions', 'vouchers'));
DELETE FROM permissions WHERE resource IN ('promotions', 'vouchers');

COMMIT;
