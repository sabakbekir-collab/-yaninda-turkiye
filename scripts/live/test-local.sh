#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
CONFIG="$ROOT/.wrangler-live-test.jsonc"
TMP_ID="$(cat /proc/sys/kernel/random/uuid)"
REPORT="${E2E_REPORT:-$ROOT/e2e-live-schema-report.txt}"
FIXTURE_LOCAL="$ROOT/.live-schema-local.sql"
cleanup() { rm -f "$CONFIG" "$FIXTURE_LOCAL"; }
trap cleanup EXIT
sed "s/3edba257-0694-4b38-adb4-865e4aa9dac4/$TMP_ID/" wrangler.jsonc > "$CONFIG"
export WRANGLER_CONFIG="./.wrangler-live-test.jsonc"
export E2E_SKIP_MIGRATIONS=1
export E2E_REPORT="$REPORT"
: > "$REPORT"

run_sql() { npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file "$1"; }
echo "INFO  Loading exact observed live schema fixture into isolated local D1" | tee -a "$REPORT"
# D1 owns its internal _cf_KV table; creating it from SQL is rejected with SQLITE_AUTH.
# Seed every application table/index from the fixture, while leaving that system table to D1.
sed '/^CREATE TABLE _cf_KV /d' scripts/live/fixtures/live-schema.sql > "$FIXTURE_LOCAL"
run_sql "$FIXTURE_LOCAL"
echo "INFO  go-live.sh preflight -> apply -> verify -> apply -> verify" | tee -a "$REPORT"
export DB_TARGET=local
export GO_LIVE_CONFIRM=EVET
bash scripts/live/go-live.sh preflight | tee -a "$REPORT"
bash scripts/live/go-live.sh apply | tee -a "$REPORT"
bash scripts/live/go-live.sh verify | tee -a "$REPORT"
bash scripts/live/go-live.sh apply | tee -a "$REPORT"
bash scripts/live/go-live.sh verify | tee -a "$REPORT"
unset DB_TARGET GO_LIVE_CONFIRM
env -u TELEGRAM_BOT_TOKEN -u TELEGRAM_TEST_CHAT_ID bash scripts/local-e2e.sh
