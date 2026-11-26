#!/usr/bin/env bash
# End-to-end run on a fresh database: rebuild scmc_sms_e2e, seed through the API,
# trade a day, verify. The backend must be running against scmc_sms_e2e:
#   DATABASE_URL=postgresql://backbone_user:backbone_password@127.0.0.1:5434/scmc_sms_e2e npm run start:dev
# and Supabase local must be up (npx supabase start, from the repo root).
set -euo pipefail
cd "$(dirname "$0")/../.."
export DATABASE_URL="${E2E_DATABASE_URL:-postgresql://backbone_user:backbone_password@127.0.0.1:5434/scmc_sms_e2e}"
export E2E_SUPABASE_ANON_KEY="${E2E_SUPABASE_ANON_KEY:-$(grep ^VITE_SUPABASE_ANON_KEY ../frontend/.env | cut -d= -f2)}"
TEST_DB=scmc_sms_e2e bash test/integration/setup-db.sh >/dev/null
sleep 2
curl -s -o /dev/null http://127.0.0.1:3001/api/health || true
run() { npx ts-node -r tsconfig-paths/register "test/e2e-real/$1.ts"; }
case "${1:-all}" in
  seed) run seed ;;
  all) run seed && run trade && run verify ;;
esac
