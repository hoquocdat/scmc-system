-- Migration: Sales Order Enhancements for Employee Sales Order Management
-- Description: Adds discount type support, employee assignment, and receivable tracking

-- Add discount_type and discount_percent columns to sales_orders
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0;

-- Add comment for discount_type column
COMMENT ON COLUMN sales_orders.discount_type IS 'Type of discount: fixed (amount) or percent';
COMMENT ON COLUMN sales_orders.discount_percent IS 'Percentage discount if discount_type is percent';

-- Create customer_receivables table for tracking customer account receivables
CREATE TABLE IF NOT EXISTS customer_receivables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    original_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    balance DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partial, paid
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sales_order_id)
);

-- Create indexes for customer_receivables
CREATE INDEX IF NOT EXISTS idx_customer_receivables_customer ON customer_receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_status ON customer_receivables(status);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_due_date ON customer_receivables(due_date);

-- Add trigger to update customer_receivables when payment is made
CREATE OR REPLACE FUNCTION update_customer_receivable()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the receivable when a payment is added
    UPDATE customer_receivables
    SET
        paid_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM sales_order_payments
            WHERE sales_order_id = NEW.sales_order_id
            AND status = 'completed'
        ),
        balance = original_amount - (
            SELECT COALESCE(SUM(amount), 0)
            FROM sales_order_payments
            WHERE sales_order_id = NEW.sales_order_id
            AND status = 'completed'
        ),
        status = CASE
            WHEN (
                SELECT COALESCE(SUM(amount), 0)
                FROM sales_order_payments
                WHERE sales_order_id = NEW.sales_order_id
                AND status = 'completed'
            ) >= original_amount THEN 'paid'
            WHEN (
                SELECT COALESCE(SUM(amount), 0)
                FROM sales_order_payments
                WHERE sales_order_id = NEW.sales_order_id
                AND status = 'completed'
            ) > 0 THEN 'partial'
            ELSE 'unpaid'
        END,
        updated_at = now()
    WHERE sales_order_id = NEW.sales_order_id;

    -- Also update paid_amount in sales_orders
    UPDATE sales_orders
    SET paid_amount = (
        SELECT COALESCE(SUM(amount), 0)
        FROM sales_order_payments
        WHERE sales_order_id = NEW.sales_order_id
        AND status = 'completed'
    )
    WHERE id = NEW.sales_order_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment updates
DROP TRIGGER IF EXISTS trg_update_customer_receivable ON sales_order_payments;
CREATE TRIGGER trg_update_customer_receivable
AFTER INSERT OR UPDATE ON sales_order_payments
FOR EACH ROW
EXECUTE FUNCTION update_customer_receivable();

-- Create function to auto-generate sales order number
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TRIGGER AS $$
DECLARE
    new_order_number VARCHAR(50);
    order_count INTEGER;
BEGIN
    -- Only generate if order_number is empty
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        -- Get count of orders today
        SELECT COUNT(*) + 1 INTO order_count
        FROM sales_orders
        WHERE DATE(created_at) = DATE(now());

        -- Format: SO-YYYYMMDD-XXXX
        new_order_number := 'SO-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(order_count::TEXT, 4, '0');
        NEW.order_number := new_order_number;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating order number
DROP TRIGGER IF EXISTS trg_generate_sales_order_number ON sales_orders;
CREATE TRIGGER trg_generate_sales_order_number
BEFORE INSERT ON sales_orders
FOR EACH ROW
EXECUTE FUNCTION generate_sales_order_number();

-- Add status 'draft' to existing orders if needed (for existing data compatibility)
-- Update status check constraint if exists
DO $$
BEGIN
    -- The status column already allows any VARCHAR, so we just need to ensure
    -- the application handles the draft status properly
    -- No constraint changes needed
    NULL;
END $$;
