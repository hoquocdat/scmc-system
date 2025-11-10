const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/002_remove_bike_owners.sql');
    console.log('📖 Reading migration file:', migrationPath);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Executing migration...\n');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\n🎉 The bike_owner_id column has been removed.');
    console.log('✅ You can now create service orders!\n');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed.');
  }
}

runMigration();
