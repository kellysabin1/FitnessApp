#!/usr/bin/env bash
# Database security tests: builds a throwaway local Postgres, applies the PREVIOUS schema (from git),
# upgrades it to the current schema.sql twice (it must be re-runnable), then runs rls_test.sql.
#
#   npm run test:db               # needs Postgres 15+ server binaries (initdb, pg_ctl) and psql
#   PG_BIN=/usr/lib/postgresql/16/bin npm run test:db
#
# Every check in rls_test.sql prints "--- Tnn … (expect …)" followed by the result; the script fails if
# psql reports an error that the test didn't ask for.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
PG_BIN=${PG_BIN:-$(dirname "$(command -v initdb)")}
PORT=${PGTEST_PORT:-5444}
DIR=$(mktemp -d)
SOCK=$DIR/sock
mkdir -p "$SOCK"
RUN=""
if [ "$(id -u)" = "0" ]; then
  # initdb refuses to run as root
  chown -R postgres "$DIR"
  RUN="su postgres -c"
else
  RUN="bash -c"
fi
cleanup() { $RUN "$PG_BIN/pg_ctl -D $DIR/data stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

$RUN "$PG_BIN/initdb -D $DIR/data -A trust -U postgres" >/dev/null
$RUN "$PG_BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $SOCK -c listen_addresses=' -l $DIR/log start -w" >/dev/null
P="psql -h $SOCK -p $PORT -U postgres -q -X"

# Minimal stand-ins for what Supabase provides: roles, auth.users and auth.uid()
$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role; grant execute on function auth.uid() to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to authenticated, service_role;
SQL

echo "› upgrade test: previous schema → current (twice)"
if git show HEAD~1:supabase/schema.sql >"$DIR/prev.sql" 2>/dev/null; then
  $P -v ON_ERROR_STOP=1 -f "$DIR/prev.sql" >/dev/null 2>&1
fi
$P -v ON_ERROR_STOP=1 -f supabase/schema.sql >/dev/null 2>&1
$P -v ON_ERROR_STOP=1 -f supabase/schema.sql >/dev/null 2>&1
echo "  ok"

$P -At -c "insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c');"
echo "› security checks (rls_test.sql)"
$P -f supabase/rls_test.sql >"$DIR/out.txt" 2>&1 || true
CHECKS=$(grep -c '^--- T' "$DIR/out.txt")

# An ERROR is expected only inside a check whose description says "ERROR".
UNEXPECTED=$(awk '/^--- T/{t=$0} /ERROR:/ && t !~ /ERROR/ {print t" → "$0}' "$DIR/out.txt")
if [ -n "$UNEXPECTED" ]; then
  echo "  unexpected errors:"; echo "$UNEXPECTED"; exit 1
fi
echo "  $CHECKS checks ran with no unexpected errors"
if [ "${VERBOSE:-}" = "1" ]; then cat "$DIR/out.txt"; fi
