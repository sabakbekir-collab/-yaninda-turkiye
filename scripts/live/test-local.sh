#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
CONFIG="$ROOT/.wrangler-live-test.jsonc"
TMP_ID="$(cat /proc/sys/kernel/random/uuid)"
REPORT="${E2E_REPORT:-$ROOT/e2e-live-schema-report.txt}"
cleanup() { rm -f "$CONFIG"; }
trap cleanup EXIT
sed "s/3edba257-0694-4b38-adb4-865e4aa9dac4/$TMP_ID/" wrangler.jsonc > "$CONFIG"
export WRANGLER_CONFIG="./.wrangler-live-test.jsonc"
export E2E_SKIP_MIGRATIONS=1
export E2E_REPORT="$REPORT"
: > "$REPORT"
echo "INFO  live-schema.sql absent; using 0001+0002 as an explicitly limited baseline fixture" | tee -a "$REPORT"
npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file migrations/0001_init.sql
npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file migrations/0002_admin_logs.sql
for file in scripts/live/columns/*.sql; do
  npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file "$file"
done
npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file scripts/live/apply-0003-0004.sql
npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file scripts/live/verify.sql
# Repeat only the idempotent aggregate file. ALTER files are one-shot by design.
npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file scripts/live/apply-0003-0004.sql
npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file scripts/live/verify.sql
echo "PASS  additive SQL repeatability and schema verification" | tee -a "$REPORT"
env -u TELEGRAM_BOT_TOKEN -u TELEGRAM_TEST_CHAT_ID bash scripts/local-e2e.sh
