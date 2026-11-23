#!/usr/bin/env bash
# Creates (or recreates) the integration test database and applies every raw
# SQL migration in order.
#
#   npm run test:int:setup
#
# Environment:
#   PG_CONTAINER   docker container running Postgres (default backbone_postgres)
#   PG_USER        (default backbone_user)
#   TEST_DB        (default scmc_sms_test)
#
# Two migrations do not apply cleanly to an empty database and are patched
# here only (the committed files are unchanged):
#   008_permissions_system.sql refers to the enum as "UserRole"; the init
#     migration created it as user_role.
#   017_sales_order_enhancements.sql redefines generate_sales_order_number()
#     with a different return type, which requires dropping the 006 version.
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-backbone_postgres}"
PG_USER="${PG_USER:-backbone_user}"
TEST_DB="${TEST_DB:-scmc_sms_test}"
MIG_DIR="$(cd "$(dirname "$0")/../../prisma/migrations" && pwd)"

psql_admin() { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -q -U "$PG_USER" -d postgres "$@"; }
psql_test()  { docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -q -U "$PG_USER" -d "$TEST_DB" "$@"; }

echo "Recreating database $TEST_DB in container $PG_CONTAINER"
psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEST_DB' AND pid <> pg_backend_pid();" >/dev/null
psql_admin -c "DROP DATABASE IF EXISTS $TEST_DB;"
psql_admin -c "CREATE DATABASE $TEST_DB;"

apply() {
  local file="$1"
  echo "  applying $(basename "$file")"
  case "$(basename "$file")" in
    008_permissions_system.sql)
      sed 's/ALTER TYPE "UserRole"/ALTER TYPE user_role/' "$file" | psql_test ;;
    017_sales_order_enhancements.sql)
      psql_test -c "DROP FUNCTION IF EXISTS generate_sales_order_number();"
      psql_test < "$file" ;;
    *)
      psql_test < "$file" ;;
  esac
}

apply "$MIG_DIR/20251107045751_init_public_schema_only/migration.sql"
for f in $(ls "$MIG_DIR"/0*.sql | sort); do
  apply "$f"
done

# Production dropped this unique constraint (003), but the init migration also
# created a unique index with another name; keep the test schema aligned.
psql_test -c "DROP INDEX IF EXISTS idx_bikes_license;" || true

echo "Test database ready: $TEST_DB"
