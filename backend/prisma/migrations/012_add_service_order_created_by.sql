-- Add created_by_id column to service_orders table
-- This tracks which user created the service order
ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES public.user_profiles(id);

-- Add index for created_by_id
CREATE INDEX IF NOT EXISTS idx_service_orders_created_by ON public.service_orders (created_by_id);

-- Add salesperson_id column to customers table
-- This tracks which salesperson is responsible for the customer
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES public.user_profiles(id);

-- Add index for salesperson_id
CREATE INDEX IF NOT EXISTS idx_customers_salesperson ON public.customers (salesperson_id);
