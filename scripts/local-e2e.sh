#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -e .dev.vars ]]; then
  printf '%s\n' ".dev.vars zaten var; üzerine yazılmadı." >&2
  exit 1
fi
TMP="$(mktemp -d)"
PORT="${PORT:-8791}"
cleanup() {
  if [[ -n "${WORKER_PID:-}" ]]; then kill "$WORKER_PID" 2>/dev/null || true; wait "$WORKER_PID" 2>/dev/null || true; fi
  rm -f .dev.vars
  rm -rf "$TMP"
}
trap cleanup EXIT

cat >.dev.vars <<'VARS'
TELEGRAM_BOT_TOKEN=local-fake-token
TELEGRAM_WEBHOOK_SECRET=local-fake-secret
TELEGRAM_ADMIN_CHAT_IDS=99999
VARS
chmod 600 .dev.vars
npx --yes wrangler@4 dev --local --ip 127.0.0.1 --port "$PORT" --persist-to "$TMP/d1" >"$TMP/worker.log" 2>&1 &
WORKER_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl --silent --fail "http://127.0.0.1:$PORT/api/health" >"$TMP/health.json"; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  printf '%s\n' "Local Worker başlatılamadı." >&2
  exit 1
fi
node --input-type=module - "$TMP/health.json" <<'NODE'
import fs from 'node:fs';
const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (value.ok !== true || value.database !== true) process.exit(1);
NODE

unauthorized_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -X POST "http://127.0.0.1:$PORT/api/telegram" \
  -H 'Content-Type: application/json' -H 'X-Telegram-Bot-Api-Secret-Token: local-fake-secret' \
  --data '{"message":{"chat":{"id":99998,"type":"private"},"text":"/yardim"}}')"
[[ "$unauthorized_status" == "200" ]]

bad_secret_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  -X POST "http://127.0.0.1:$PORT/api/telegram" \
  -H 'Content-Type: application/json' -H 'X-Telegram-Bot-Api-Secret-Token: wrong' \
  --data '{"message":{"chat":{"id":99999,"type":"private"},"text":"/yardim"}}')"
[[ "$bad_secret_status" == "401" ]]

if [[ "${SCHEMA_SMOKE:-0}" == "1" ]]; then
  npx --yes wrangler@4 d1 execute yaninda-turkiye-db --local --persist-to "$TMP/d1" --file scripts/live/duty-schema-fixture.sql >"$TMP/fixture.txt"
  npx --yes wrangler@4 d1 execute yaninda-turkiye-db --local --persist-to "$TMP/d1" --file scripts/live/apply-duty.sql >"$TMP/apply1.txt"
  npx --yes wrangler@4 d1 execute yaninda-turkiye-db --local --persist-to "$TMP/d1" --file scripts/live/apply-duty.sql >"$TMP/apply2.txt"
  npx --yes wrangler@4 d1 execute yaninda-turkiye-db --local --persist-to "$TMP/d1" --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('duty_pharmacies','duty_sync_runs') ORDER BY name" >"$TMP/schema.txt"
  grep -q duty_pharmacies "$TMP/schema.txt"
  grep -q duty_sync_runs "$TMP/schema.txt"
fi
printf '%s\n' "node tests/duty-import.test.mjs
Local Worker E2E başarılı."
