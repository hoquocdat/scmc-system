-- Rollback for ../021_pos_checkout_core.sql (apply manually; not part of the forward migration set)
-- Restores the 017 order-number function, the 006 inventory trigger function,
-- and drops the added columns, indexes, permissions and counter table.
-- Orders created with the new numbering keep their numbers (format is unchanged).

-- 6. Inventory trigger function as in 006_pos_foundation.sql
CREATE OR REPLACE FUNCTION update_inventory_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type IN ('RECEIVE', 'ADJUST', 'RETURN') THEN
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + NEW.quantity,
        updated_at = NOW()
    WHERE location_id = NEW.location_id
      AND (product_id = NEW.product_id OR product_variant_id = NEW.product_variant_id);
  ELSIF NEW.transaction_type IN ('SALE', 'TRANSFER_OUT') THEN
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand - ABS(NEW.quantity),
        updated_at = NOW()
    WHERE location_id = NEW.location_id
      AND (product_id = NEW.product_id OR product_variant_id = NEW.product_variant_id);
  ELSIF NEW.transaction_type = 'TRANSFER_IN' THEN
    UPDATE inventory
    SET quantity_on_hand = quantity_on_hand + NEW.quantity,
        updated_at = NOW()
    WHERE location_id = NEW.location_id
      AND (product_id = NEW.product_id OR product_variant_id = NEW.product_variant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Permissions
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE name IN ('pos:approve', 'pos:credit', 'pos:supervise', 'pos:reprint'));
DELETE FROM permissions WHERE name IN ('pos:approve', 'pos:credit', 'pos:supervise', 'pos:reprint');

-- 4. roles
ALTER TABLE roles DROP COLUMN IF EXISTS max_discount_percent;

-- 3. pos_sessions
DROP INDEX IF EXISTS uq_pos_sessions_one_open_per_user;
DROP INDEX IF EXISTS idx_pos_sessions_store;
ALTER TABLE pos_sessions DROP COLUMN IF EXISTS closed_by, DROP COLUMN IF EXISTS store_id;

-- 2. sales_orders
DROP INDEX IF EXISTS idx_sales_orders_pos_session;
DROP INDEX IF EXISTS uq_sales_orders_client_request;
ALTER TABLE sales_orders
  DROP COLUMN IF EXISTS discount_approved_by,
  DROP COLUMN IF EXISTS client_request_id,
  DROP COLUMN IF EXISTS pos_session_id;

-- Subtotal trigger as in 006_pos_foundation.sql (function update_sales_order_totals still exists)
DROP TRIGGER IF EXISTS trg_sales_order_items_totals ON sales_order_items;
CREATE TRIGGER trg_sales_order_items_totals
  AFTER INSERT OR UPDATE OR DELETE ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_totals();

-- 1. Order numbering as in 017_sales_order_enhancements.sql
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TRIGGER AS $$
DECLARE
    new_order_number VARCHAR(50);
    order_count INTEGER;
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        SELECT COUNT(*) + 1 INTO order_count
        FROM sales_orders
        WHERE DATE(created_at) = DATE(now());
        new_order_number := 'SO-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(order_count::TEXT, 4, '0');
        NEW.order_number := new_order_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS next_document_number(VARCHAR, VARCHAR);
DROP TABLE IF EXISTS document_counters;
