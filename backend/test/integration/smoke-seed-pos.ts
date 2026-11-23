/**
 * Seeds the integration test database with the sales/POS fixtures for manual
 * or scripted API checks of the POS flow, and prints ids as JSON.
 *
 *   npx ts-node -r tsconfig-paths/register test/integration/smoke-seed-pos.ts
 */
import { closeTestDb, resetTestDb } from './db';
import { seedSalesFixtures } from './sales-fixtures';

async function main() {
  await resetTestDb();
  const fx = await seedSalesFixtures();
  console.log(JSON.stringify(fx, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeTestDb);
