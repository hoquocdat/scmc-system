-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    default_warehouse_id UUID REFERENCES stock_locations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(code);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);

-- Add store_id to sales_orders
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_orders_store ON sales_orders(store_id);

-- Add store_id to service_orders
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_store ON service_orders(store_id);

-- Insert default store linked to existing warehouse
INSERT INTO stores (name, code, is_active, is_default, default_warehouse_id)
SELECT
    'Cửa hàng chính',
    'MAIN',
    true,
    true,
    (SELECT id FROM stock_locations WHERE is_default = true LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE code = 'MAIN');

-- Update existing sales_orders to use the default store
UPDATE sales_orders
SET store_id = (SELECT id FROM stores WHERE is_default = true LIMIT 1)
WHERE store_id IS NULL;

-- Update existing service_orders to use the default store
UPDATE service_orders
SET store_id = (SELECT id FROM stores WHERE is_default = true LIMIT 1)
WHERE store_id IS NULL;
