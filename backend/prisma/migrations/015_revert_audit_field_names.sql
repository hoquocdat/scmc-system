-- Revert audit field names: add back _id suffix to avoid Prisma relation naming conflicts
-- created_by -> created_by_id
-- updated_by -> updated_by_id

-- Customers table
ALTER TABLE public.customers
RENAME COLUMN created_by TO created_by_id;

ALTER TABLE public.customers
RENAME COLUMN updated_by TO updated_by_id;

-- Rename indexes for customers
DROP INDEX IF EXISTS idx_customers_created_by;
DROP INDEX IF EXISTS idx_customers_updated_by;
CREATE INDEX idx_customers_created_by ON public.customers (created_by_id);
CREATE INDEX idx_customers_updated_by ON public.customers (updated_by_id);

-- Bikes table
ALTER TABLE public.bikes
RENAME COLUMN created_by TO created_by_id;

ALTER TABLE public.bikes
RENAME COLUMN updated_by TO updated_by_id;

-- Rename indexes for bikes
DROP INDEX IF EXISTS idx_bikes_created_by;
DROP INDEX IF EXISTS idx_bikes_updated_by;
CREATE INDEX idx_bikes_created_by ON public.bikes (created_by_id);
CREATE INDEX idx_bikes_updated_by ON public.bikes (updated_by_id);

-- Service orders table
ALTER TABLE public.service_orders
RENAME COLUMN created_by TO created_by_id;

ALTER TABLE public.service_orders
RENAME COLUMN updated_by TO updated_by_id;

-- Rename indexes for service_orders
DROP INDEX IF EXISTS idx_service_orders_created_by;
DROP INDEX IF EXISTS idx_service_orders_updated_by;
CREATE INDEX idx_service_orders_created_by ON public.service_orders (created_by_id);
CREATE INDEX idx_service_orders_updated_by ON public.service_orders (updated_by_id);
