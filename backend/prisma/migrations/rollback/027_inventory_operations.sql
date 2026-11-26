-- Rollback of 027_inventory_operations.sql
BEGIN;

-- Previous trigger (from 021): WRITE_OFF no longer moves stock
CREATE OR REPLACE FUNCTION update_inventory_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_delta INTEGER;
BEGIN
  IF NEW.transaction_type IN ('RECEIVE', 'ADJUST', 'RETURN', 'TRANSFER_IN') THEN
    v_delta := NEW.quantity;
  ELSIF NEW.transaction_type IN ('SALE', 'TRANSFER_OUT') THEN
    v_delta := -ABS(NEW.quantity);
  ELSE
    RETURN NEW;
  END IF;
  IF NEW.product_variant_id IS NOT NULL THEN
    UPDATE inventory SET quantity_on_hand = quantity_on_hand + v_delta, updated_at = NOW()
    WHERE location_id = NEW.location_id AND product_variant_id = NEW.product_variant_id;
  ELSE
    UPDATE inventory SET quantity_on_hand = quantity_on_hand + v_delta, updated_at = NOW()
    WHERE location_id = NEW.location_id AND product_id = NEW.product_id AND product_variant_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP SEQUENCE IF EXISTS barcode_seq;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS chk_purchase_order_items_unit_factor, DROP COLUMN IF EXISTS unit_factor, DROP COLUMN IF EXISTS unit_name;
ALTER TABLE sales_order_items DROP CONSTRAINT IF EXISTS chk_sales_order_items_unit_factor, DROP COLUMN IF EXISTS unit_factor, DROP COLUMN IF EXISTS unit_name;
DROP TABLE IF EXISTS product_units;
DROP INDEX IF EXISTS uq_product_variants_barcode;
DROP INDEX IF EXISTS uq_products_barcode;
ALTER TABLE product_variants DROP COLUMN IF EXISTS barcode;
ALTER TABLE products DROP COLUMN IF EXISTS base_unit, DROP COLUMN IF EXISTS barcode;
DROP TABLE IF EXISTS stock_write_off_items;
DROP TABLE IF EXISTS stock_write_offs;
DROP TABLE IF EXISTS stock_count_items;
DROP TABLE IF EXISTS stock_counts;
ALTER TABLE transfer_order_items DROP CONSTRAINT IF EXISTS chk_transfer_order_items_item, DROP CONSTRAINT IF EXISTS chk_transfer_order_items_qty,
  DROP COLUMN IF EXISTS unit_cost, DROP COLUMN IF EXISTS quantity_discrepancy;
ALTER TABLE transfer_orders DROP CONSTRAINT IF EXISTS chk_transfer_orders_status, ALTER COLUMN status DROP NOT NULL,
  DROP COLUMN IF EXISTS cancel_reason, DROP COLUMN IF EXISTS cancelled_by, DROP COLUMN IF EXISTS cancelled_at;

DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name IN ('inventory:write_off', 'inventory:count', 'inventory:approve_count', 'inventory:labels'));
DELETE FROM permissions WHERE name IN ('inventory:write_off', 'inventory:count', 'inventory:approve_count', 'inventory:labels');

COMMIT;
