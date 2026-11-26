-- Rollback of 029_report_indexes.sql
BEGIN;
DROP INDEX IF EXISTS idx_sales_returns_created;
DROP INDEX IF EXISTS idx_inventory_transactions_product_date;
DROP INDEX IF EXISTS idx_inventory_transactions_variant_date;
DROP INDEX IF EXISTS idx_inventory_transactions_type_date;
DROP INDEX IF EXISTS idx_sales_orders_created_by;
COMMIT;
