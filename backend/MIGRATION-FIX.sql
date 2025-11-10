-- Quick fix to remove bike_owner_id column from service_orders
-- Copy and paste this into your Supabase SQL Editor:
-- https://mohskegpsanicceththa.supabase.co/project/_/sql

-- Step 1: Drop the bike_owner_id column
ALTER TABLE service_orders DROP COLUMN IF EXISTS bike_owner_id;

-- Done! This single line fixes the issue.
-- After running this, you can create service orders successfully.
