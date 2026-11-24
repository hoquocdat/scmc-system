-- 029: indexes for the retail report suite (change reports-retail-suite)
BEGIN;
CREATE INDEX IF NOT EXISTS idx_sales_returns_created ON sales_returns(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_date ON inventory_transactions(product_id, location_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_variant_date ON inventory_transactions(product_variant_id, location_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type_date ON inventory_transactions(transaction_type, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_by ON sales_orders(created_by);
COMMIT;
