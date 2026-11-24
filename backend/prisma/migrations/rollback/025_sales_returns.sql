-- Rollback of 025_sales_returns.sql
BEGIN;

ALTER TABLE sales_orders
  DROP CONSTRAINT IF EXISTS chk_sales_orders_return_status,
  DROP COLUMN IF EXISTS return_status,
  DROP COLUMN IF EXISTS returned_amount;
ALTER TABLE sales_order_items
  DROP CONSTRAINT IF EXISTS chk_sales_order_items_returned,
  DROP COLUMN IF EXISTS returned_amount,
  DROP COLUMN IF EXISTS returned_quantity;

DROP TABLE IF EXISTS sales_return_refunds;
DROP TABLE IF EXISTS sales_return_items;
DROP TABLE IF EXISTS sales_returns;
DROP TABLE IF EXISTS customer_credit_transactions;
ALTER TABLE customers DROP COLUMN IF EXISTS credit_balance;

DELETE FROM cash_book_categories
WHERE code = 'sales_return' AND direction = 'out'
  AND NOT EXISTS (SELECT 1 FROM cash_book_entries e WHERE e.category_id = cash_book_categories.id);

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE resource = 'sales_returns');
DELETE FROM permissions WHERE resource = 'sales_returns';

COMMIT;
