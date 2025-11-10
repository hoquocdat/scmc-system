-- Rename customer_complaint to customer_demand for better semantic clarity
ALTER TABLE public.service_orders
RENAME COLUMN customer_complaint TO customer_demand;

COMMENT ON COLUMN public.service_orders.customer_demand IS 'What the customer requests or wants to be done (e.g., scheduled maintenance, upgrades, specific work requests)';
