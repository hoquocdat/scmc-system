-- Fix trigger to recalculate purchase order totals correctly
-- The issue: the original trigger tried to use subtotal in the same UPDATE where it was being calculated
-- This meant it used the OLD subtotal value (0) instead of the newly calculated value

DROP TRIGGER IF EXISTS trigger_recalculate_po_totals_insert ON purchase_order_items;
DROP TRIGGER IF EXISTS trigger_recalculate_po_totals_update ON purchase_order_items;
DROP TRIGGER IF EXISTS trigger_recalculate_po_totals_delete ON purchase_order_items;
DROP FUNCTION IF EXISTS recalculate_purchase_order_totals();

CREATE OR REPLACE FUNCTION recalculate_purchase_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_purchase_order_id UUID;
  v_subtotal DECIMAL(10, 2);
  v_tax_amount DECIMAL(10, 2);
  v_shipping_cost DECIMAL(10, 2);
  v_discount_amount DECIMAL(10, 2);
  v_total_amount DECIMAL(10, 2);
BEGIN
  -- Get the purchase order ID
  v_purchase_order_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  -- Calculate subtotal from items
  SELECT COALESCE(SUM(total_cost), 0)
  INTO v_subtotal
  FROM purchase_order_items
  WHERE purchase_order_id = v_purchase_order_id;

  -- Get other amounts from the purchase order
  SELECT
    COALESCE(tax_amount, 0),
    COALESCE(shipping_cost, 0),
    COALESCE(discount_amount, 0)
  INTO
    v_tax_amount,
    v_shipping_cost,
    v_discount_amount
  FROM purchase_orders
  WHERE id = v_purchase_order_id;

  -- Calculate total
  v_total_amount := v_subtotal + v_tax_amount + v_shipping_cost - v_discount_amount;

  -- Update purchase order with calculated values
  UPDATE purchase_orders
  SET
    subtotal = v_subtotal,
    total_amount = v_total_amount
  WHERE id = v_purchase_order_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_po_totals_insert
  AFTER INSERT ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_purchase_order_totals();

CREATE TRIGGER trigger_recalculate_po_totals_update
  AFTER UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_purchase_order_totals();

CREATE TRIGGER trigger_recalculate_po_totals_delete
  AFTER DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_purchase_order_totals();
