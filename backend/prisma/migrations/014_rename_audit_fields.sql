-- Rename audit fields: remove _id suffix for cleaner naming
-- created_by_id -> created_by
-- updated_by_id -> updated_by

-- Customers table
ALTER TABLE public.customers
RENAME COLUMN created_by_id TO created_by;

ALTER TABLE public.customers
RENAME COLUMN updated_by_id TO updated_by;

-- Rename indexes for customers
DROP INDEX IF EXISTS idx_customers_created_by;
DROP INDEX IF EXISTS idx_customers_updated_by;
CREATE INDEX idx_customers_created_by ON public.customers (created_by);
CREATE INDEX idx_customers_updated_by ON public.customers (updated_by);

-- Bikes table
ALTER TABLE public.bikes
RENAME COLUMN created_by_id TO created_by;

ALTER TABLE public.bikes
RENAME COLUMN updated_by_id TO updated_by;

-- Rename indexes for bikes
DROP INDEX IF EXISTS idx_bikes_created_by;
DROP INDEX IF EXISTS idx_bikes_updated_by;
CREATE INDEX idx_bikes_created_by ON public.bikes (created_by);
CREATE INDEX idx_bikes_updated_by ON public.bikes (updated_by);

-- Service orders table
ALTER TABLE public.service_orders
RENAME COLUMN created_by_id TO created_by;

ALTER TABLE public.service_orders
RENAME COLUMN updated_by_id TO updated_by;

-- Rename indexes for service_orders
DROP INDEX IF EXISTS idx_service_orders_created_by;
DROP INDEX IF EXISTS idx_service_orders_updated_by;
CREATE INDEX idx_service_orders_created_by ON public.service_orders (created_by);
CREATE INDEX idx_service_orders_updated_by ON public.service_orders (updated_by);
