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

run_sql() { npx wrangler d1 execute DB --local --config "$WRANGLER_CONFIG" --file "$1"; }
echo "INFO  Loading exact observed live schema fixture into isolated local D1" | tee -a "$REPORT"
run_sql scripts/live/fixtures/live-schema.sql
echo "INFO  Applying only fixture-proven missing columns" | tee -a "$REPORT"
for file in scripts/live/columns/*.sql; do
  run_sql "$file"
done
run_sql scripts/live/apply-0003-0004.sql
run_sql scripts/live/verify.sql

echo "INFO  Re-running one-shot ALTER files: failure is expected because columns now exist" | tee -a "$REPORT"
for file in scripts/live/columns/*.sql; do
  if run_sql "$file" > /tmp/live-alter-repeat.log 2>&1; then
    echo "FAIL  ALTER unexpectedly succeeded on second application: $file" | tee -a "$REPORT"
    cat /tmp/live-alter-repeat.log
    exit 1
  else
    if ! grep -Eqi 'duplicate column name|already exists' /tmp/live-alter-repeat.log; then
      echo "FAIL  ALTER failed for an unexpected reason: $file" | tee -a "$REPORT"
      cat /tmp/live-alter-repeat.log
      exit 1
    fi
    echo "PASS  expected duplicate-column rejection: $file" | tee -a "$REPORT"
  fi
done
echo "INFO  Re-running idempotent object SQL and verification" | tee -a "$REPORT"
run_sql scripts/live/apply-0003-0004.sql
run_sql scripts/live/verify.sql
echo "PASS  fixture schema + additive objects are repeatable (ALTER reruns rejected as expected)" | tee -a "$REPORT"

env -u TELEGRAM_BOT_TOKEN -u TELEGRAM_TEST_CHAT_ID bash scripts/local-e2e.sh
