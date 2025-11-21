-- Add audit metadata columns to customers table
-- created_by_id: who created the record
-- updated_by_id: who last updated the record
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES public.user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers (created_by_id);
CREATE INDEX IF NOT EXISTS idx_customers_updated_by ON public.customers (updated_by_id);

-- Add audit metadata columns to bikes table
ALTER TABLE public.bikes
ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES public.user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_bikes_created_by ON public.bikes (created_by_id);
CREATE INDEX IF NOT EXISTS idx_bikes_updated_by ON public.bikes (updated_by_id);

-- Add updated_by_id to service_orders table (created_by_id already exists)
ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES public.user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_service_orders_updated_by ON public.service_orders (updated_by_id);
