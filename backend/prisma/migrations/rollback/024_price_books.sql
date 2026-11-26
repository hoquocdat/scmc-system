-- Rollback of 024_price_books.sql
BEGIN;

ALTER TABLE sales_orders DROP COLUMN IF EXISTS price_book_id;
ALTER TABLE sales_order_items
  DROP COLUMN IF EXISTS price_book_id,
  DROP COLUMN IF EXISTS base_unit_price,
  DROP COLUMN IF EXISTS price_source;

DROP TABLE IF EXISTS price_book_entries;
DROP TABLE IF EXISTS price_book_customer_groups;
DROP TABLE IF EXISTS price_book_stores;
DROP TABLE IF EXISTS price_books;
DROP TABLE IF EXISTS customer_group_members;
DROP TABLE IF EXISTS customer_groups;

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE resource IN ('price_books', 'customer_groups'));
DELETE FROM permissions WHERE resource IN ('price_books', 'customer_groups');

COMMIT;
