const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running migration 002_remove_bike_owners...\n');

  // Step 1: Drop the bike_owner_id column from service_orders
  console.log('Step 1: Removing bike_owner_id column from service_orders...');
  try {
    // We can't run ALTER TABLE directly through Supabase JS client
    // So we'll just document what needs to be done
    console.log('⚠️  Manual SQL required in Supabase Dashboard:\n');
    console.log('ALTER TABLE service_orders DROP COLUMN IF EXISTS bike_owner_id;\n');

    console.log('📋 Please run this SQL in your Supabase SQL Editor:');
    console.log('   https://mohskegpsanicceththa.supabase.co/project/_/sql\n');

    console.log('Or copy and paste the entire file:');
    console.log('   /database/migrations/002_remove_bike_owners.sql\n');

    console.log('After running the migration, the Create Service Order feature will work!');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

runMigration();
