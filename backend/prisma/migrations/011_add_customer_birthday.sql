-- Add birthday, facebook, instagram columns to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS facebook VARCHAR(255),
ADD COLUMN IF NOT EXISTS instagram VARCHAR(255);

-- Add index for birthday to support birthday queries (e.g., upcoming birthdays)
CREATE INDEX IF NOT EXISTS idx_customers_birthday ON public.customers (birthday);
