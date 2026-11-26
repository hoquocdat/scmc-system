-- Rollback 030: back to NUMERIC(10,2). Fails if any amount is now above 99,999,999.99.
BEGIN;

DROP VIEW IF EXISTS supplier_transactions;
DROP TRIGGER IF EXISTS trigger_update_po_payment_status ON purchase_orders;

ALTER TABLE customer_receivables
  ALTER COLUMN balance TYPE NUMERIC(10,2),
  ALTER COLUMN original_amount TYPE NUMERIC(10,2),
  ALTER COLUMN paid_amount TYPE NUMERIC(10,2);

ALTER TABLE inventory_transactions
  ALTER COLUMN total_cost TYPE NUMERIC(10,2),
  ALTER COLUMN unit_cost TYPE NUMERIC(10,2);

ALTER TABLE parts
  ALTER COLUMN unit_cost TYPE NUMERIC(10,2);

ALTER TABLE payments
  ALTER COLUMN amount TYPE NUMERIC(10,2);

ALTER TABLE pos_session_transactions
  ALTER COLUMN amount TYPE NUMERIC(10,2);

ALTER TABLE pos_sessions
  ALTER COLUMN cash_difference TYPE NUMERIC(10,2),
  ALTER COLUMN closing_cash TYPE NUMERIC(10,2),
  ALTER COLUMN expected_cash TYPE NUMERIC(10,2),
  ALTER COLUMN opening_cash TYPE NUMERIC(10,2);

ALTER TABLE product_variants
  ALTER COLUMN cost_price_override TYPE NUMERIC(10,2),
  ALTER COLUMN price_adjustment TYPE NUMERIC(10,2),
  ALTER COLUMN retail_price_override TYPE NUMERIC(10,2);

ALTER TABLE products
  ALTER COLUMN cost_price TYPE NUMERIC(10,2),
  ALTER COLUMN retail_price TYPE NUMERIC(10,2),
  ALTER COLUMN sale_price TYPE NUMERIC(10,2);

ALTER TABLE purchase_order_items
  ALTER COLUMN total_cost TYPE NUMERIC(10,2),
  ALTER COLUMN unit_cost TYPE NUMERIC(10,2);

ALTER TABLE purchase_orders
  ALTER COLUMN discount_amount TYPE NUMERIC(10,2),
  ALTER COLUMN paid_amount TYPE NUMERIC(10,2),
  ALTER COLUMN shipping_cost TYPE NUMERIC(10,2),
  ALTER COLUMN subtotal TYPE NUMERIC(10,2),
  ALTER COLUMN tax_amount TYPE NUMERIC(10,2),
  ALTER COLUMN total_amount TYPE NUMERIC(10,2);

ALTER TABLE sales_order_items
  ALTER COLUMN discount_amount TYPE NUMERIC(10,2),
  ALTER COLUMN tax_amount TYPE NUMERIC(10,2),
  ALTER COLUMN total_amount TYPE NUMERIC(10,2),
  ALTER COLUMN unit_cost TYPE NUMERIC(10,2),
  ALTER COLUMN unit_price TYPE NUMERIC(10,2);

ALTER TABLE sales_order_payments
  ALTER COLUMN amount TYPE NUMERIC(10,2),
  ALTER COLUMN amount_tendered TYPE NUMERIC(10,2),
  ALTER COLUMN change_given TYPE NUMERIC(10,2);

ALTER TABLE sales_orders
  ALTER COLUMN discount_amount TYPE NUMERIC(10,2),
  ALTER COLUMN loyalty_discount_amount TYPE NUMERIC(10,2),
  ALTER COLUMN paid_amount TYPE NUMERIC(10,2),
  ALTER COLUMN shipping_cost TYPE NUMERIC(10,2),
  ALTER COLUMN subtotal TYPE NUMERIC(10,2),
  ALTER COLUMN tax_amount TYPE NUMERIC(10,2),
  ALTER COLUMN total_amount TYPE NUMERIC(10,2);

ALTER TABLE service_items
  ALTER COLUMN labor_cost TYPE NUMERIC(10,2),
  ALTER COLUMN parts_cost TYPE NUMERIC(10,2);

ALTER TABLE service_orders
  ALTER COLUMN estimated_cost TYPE NUMERIC(10,2),
  ALTER COLUMN final_cost TYPE NUMERIC(10,2);

ALTER TABLE service_parts
  ALTER COLUMN total_cost TYPE NUMERIC(10,2),
  ALTER COLUMN unit_cost TYPE NUMERIC(10,2);

ALTER TABLE supplier_payment_allocations
  ALTER COLUMN amount_allocated TYPE NUMERIC(10,2);

ALTER TABLE supplier_payments
  ALTER COLUMN amount TYPE NUMERIC(10,2);

ALTER TABLE supplier_return_items
  ALTER COLUMN total_cost TYPE NUMERIC(10,2),
  ALTER COLUMN unit_cost TYPE NUMERIC(10,2);

ALTER TABLE supplier_returns
  ALTER COLUMN total_return_amount TYPE NUMERIC(10,2);

CREATE VIEW supplier_transactions AS
SELECT po.id,
    'purchase'::supplier_transaction_type AS transaction_type,
    po.supplier_id,
    po.order_number AS reference_number,
    po.total_amount AS amount,
    po.order_date AS transaction_date,
    po.notes,
    po.created_at
   FROM purchase_orders po
  WHERE po.status = 'approved'::purchase_order_status
UNION ALL
 SELECT sr.id,
    'return'::supplier_transaction_type AS transaction_type,
    sr.supplier_id,
    sr.return_number AS reference_number,
    - sr.total_return_amount AS amount,
    sr.return_date AS transaction_date,
    sr.notes,
    sr.created_at
   FROM supplier_returns sr
  WHERE sr.status::text = 'approved'::text
UNION ALL
 SELECT sp.id,
    'payment'::supplier_transaction_type AS transaction_type,
    sp.supplier_id,
    sp.payment_number AS reference_number,
    - sp.amount AS amount,
    sp.payment_date AS transaction_date,
    sp.notes,
    sp.created_at
   FROM supplier_payments sp
  ORDER BY 6 DESC, 8 DESC;

CREATE TRIGGER trigger_update_po_payment_status
  BEFORE UPDATE OF paid_amount, total_amount ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_purchase_order_payment_status();

-- purchase order totals are summed into local variables of the same type
CREATE OR REPLACE FUNCTION public.recalculate_purchase_order_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

COMMIT;
