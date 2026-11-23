import { PrismaClient } from '@prisma/client';
import { TEST_DATABASE_URL } from './setup-env';

/**
 * Prisma client bound to the integration test database.
 * Shared by fixtures and tests so they see the same data.
 */
export const testDb = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

/** Tables that hold seed configuration and are kept between test runs. */
const KEEP_TABLES = new Set([
  '_prisma_migrations',
  'roles',
  'permissions',
  'role_permissions',
  'cash_book_categories',
  'document_counters',
]);

/**
 * Removes every business row so each test file starts from an empty database.
 * Roles and permissions (seeded by migrations) are kept.
 */
export async function resetTestDb(): Promise<void> {
  const tables = await testDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const names = tables
    .map((t) => t.tablename)
    .filter((t) => !KEEP_TABLES.has(t))
    .map((t) => `"public"."${t}"`);
  if (names.length === 0) return;
  await testDb.$executeRawUnsafe(
    `TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export async function closeTestDb(): Promise<void> {
  await testDb.$disconnect();
}
