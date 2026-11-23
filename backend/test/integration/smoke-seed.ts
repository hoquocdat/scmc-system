/**
 * Seeds the integration test database with the report fixtures plus one user
 * per role, for manual / scripted API checks against a running backend.
 *
 *   npx ts-node -r tsconfig-paths/register test/integration/smoke-seed.ts
 *
 * Prints the created user ids as JSON so a JWT can be minted for them.
 */
import { randomUUID } from 'crypto';
import { closeTestDb, resetTestDb, testDb } from './db';
import { seedReportFixtures } from './report-fixtures';

async function userWithRole(role: string): Promise<string> {
  const id = randomUUID();
  await testDb.user_profiles.create({
    data: {
      id,
      role: 'sales',
      full_name: `Smoke ${role}`,
      email: `${role}@smoke.local`,
    },
  });
  const r = await testDb.roles.findUniqueOrThrow({ where: { name: role } });
  await testDb.user_roles.create({ data: { user_id: id, role_id: r.id } });
  return id;
}

async function main() {
  await resetTestDb();
  const fixtures = await seedReportFixtures();
  const users: Record<string, string> = {};
  for (const role of [
    'manager',
    'finance',
    'store_manager',
    'warehouse_staff',
    'sales_associate',
    'technician',
  ]) {
    users[role] = await userWithRole(role);
  }
  console.log(
    JSON.stringify(
      { users, stores: fixtures.stores, locations: fixtures.locations },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeTestDb);
