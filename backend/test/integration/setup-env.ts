// Loads backend/.env so DATABASE_URL_TEST / DATABASE_URL are available to
// integration tests, then points DATABASE_URL at the test database so that
// PrismaService (which reads DATABASE_URL) never touches the dev database.
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env') });

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://backbone_user:backbone_password@127.0.0.1:5434/scmc_sms_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.TZ = 'UTC';
