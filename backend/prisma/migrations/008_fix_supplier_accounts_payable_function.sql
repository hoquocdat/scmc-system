-- Fix ambiguous column reference in get_supplier_accounts_payable function
-- Issue: "supplier_id" could refer to either the parameter or the table column

DROP FUNCTION IF EXISTS get_supplier_accounts_payable(UUID);

CREATE OR REPLACE FUNCTION get_supplier_accounts_payable(p_supplier_id UUID)
RETURNS TABLE (
  supplier_id UUID,
  total_purchases DECIMAL(10, 2),
  total_returns DECIMAL(10, 2),
  total_payments DECIMAL(10, 2),
  balance_due DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_supplier_id AS supplier_id,
    COALESCE(SUM(CASE WHEN po.status = 'approved' THEN po.total_amount ELSE 0 END), 0) AS total_purchases,
    COALESCE((
      SELECT SUM(sr.total_return_amount)
      FROM supplier_returns sr
      WHERE sr.supplier_id = p_supplier_id AND sr.status = 'approved'
    ), 0) AS total_returns,
    COALESCE((
      SELECT SUM(sp.amount)
      FROM supplier_payments sp
      WHERE sp.supplier_id = p_supplier_id
    ), 0) AS total_payments,
    COALESCE(SUM(CASE WHEN po.status = 'approved' THEN po.total_amount ELSE 0 END), 0)
    - COALESCE((
      SELECT SUM(sr.total_return_amount)
      FROM supplier_returns sr
      WHERE sr.supplier_id = p_supplier_id AND sr.status = 'approved'
    ), 0)
    - COALESCE((
      SELECT SUM(sp.amount)
      FROM supplier_payments sp
      WHERE sp.supplier_id = p_supplier_id
    ), 0) AS balance_due
  FROM purchase_orders po
  WHERE po.supplier_id = p_supplier_id;
END;
$$ LANGUAGE plpgsql;
