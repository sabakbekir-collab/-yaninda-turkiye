#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPORT="${E2E_REPORT:-$ROOT/e2e-report.txt}"
TMP_DIR="$(mktemp -d)"
PORT="${E2E_PORT:-8787}"
MOCK_PORT="${E2E_MOCK_PORT:-8799}"
BASE_URL="http://127.0.0.1:$PORT"
MOCK_URL="http://127.0.0.1:$MOCK_PORT"
WORKER_PID=""
MOCK_PID=""
FAILURES=0
FAKE_BOT_TOKEN="local-e2e-fake-token"
FAKE_WEBHOOK_SECRET="local-e2e-fake-webhook-secret"
FAKE_ADMIN_CHAT_IDS="111"

mkdir -p "$(dirname "$REPORT")"
: > "$REPORT"
exec > >(tee -a "$REPORT") 2>&1

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
info() { printf 'INFO  %s\n' "$1"; }

cleanup() {
  local code=$?
  if [[ -n "$WORKER_PID" ]]; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
    wait "$WORKER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$MOCK_PID" ]]; then
    kill "$MOCK_PID" >/dev/null 2>&1 || true
    wait "$MOCK_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
  if (( FAILURES > 0 )); then
    printf 'FAIL  E2E tamamlanmadı: %s başarısız kontrol. Rapor: %s\n' "$FAILURES" "$REPORT"
    exit 1
  fi
  if (( code != 0 )); then
    printf 'FAIL  Betik beklenmeyen hata koduyla sonlandı (%s). Rapor: %s\n' "$code" "$REPORT"
    exit "$code"
  fi
  printf 'PASS  Tüm yerel E2E kontrolleri başarılı. Rapor: %s\n' "$REPORT"
}
trap cleanup EXIT INT TERM

for cmd in node npm npx curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Gerekli komut bulunamadı: $cmd"
    exit 1
  fi
done

if [[ ! -f wrangler.jsonc ]]; then
  fail "wrangler.jsonc bulunamadı"
  exit 1
fi
if ! grep -Eq '"binding"[[:space:]]*:[[:space:]]*"DB"' wrangler.jsonc; then
  fail "wrangler.jsonc içinde DB D1 binding'i bulunamadı"
  exit 1
fi
pass "Proje yapılandırması ve DB binding bulundu"

if grep -Eq '"pages_build_output_dir"[[:space:]]*:' wrangler.jsonc; then
  RUNTIME="pages"
  PAGES_DIR="$(node -e 'const fs=require("fs");const s=fs.readFileSync("wrangler.jsonc","utf8");const m=s.match(/"pages_build_output_dir"\s*:\s*"([^"]+)"/);if(!m)process.exit(2);process.stdout.write(m[1])')"
  pass "wrangler.jsonc algılandı: Pages ($PAGES_DIR)"
elif grep -Eq '"main"[[:space:]]*:' wrangler.jsonc; then
  RUNTIME="worker"
  pass "wrangler.jsonc algılandı: Worker"
else
  fail "wrangler.jsonc içinden Pages/Worker türü belirlenemedi"
  exit 1
fi

info "Yerel D1 migration'ları uygulanıyor (--local; --remote kullanılmıyor)"
if npx wrangler d1 migrations apply DB --local --config ./wrangler.jsonc; then
  pass "0001-0004 yerel D1 migration komutu başarılı"
else
  fail "Yerel D1 migration komutu başarısız"
  exit 1
fi

info "Worker assets için yerel build hazırlanıyor"
if npm run build; then
  pass "npm run build"
else
  fail "npm run build"
  exit 1
fi

cat > "$TMP_DIR/mock-telegram.mjs" <<'MOCK'
import http from 'node:http';
const messages = [];
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/__health') {
    res.writeHead(200, {'content-type':'application/json'}); res.end('{"ok":true}'); return;
  }
  if (req.method === 'GET' && req.url === '/__messages') {
    res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify(messages)); return;
  }
  if (req.method === 'POST' && /^\/bot[^/]+\/sendMessage$/.test(req.url || '')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try {
      const body = JSON.parse(raw);
      messages.push({chat_id: body.chat_id, text: String(body.text || '')});
      res.writeHead(200, {'content-type':'application/json'});
      res.end('{"ok":true,"result":{"message_id":1}}');
    } catch {
      res.writeHead(400, {'content-type':'application/json'}); res.end('{"ok":false}');
    }
    return;
  }
  res.writeHead(404); res.end();
});
server.listen(Number(process.env.E2E_MOCK_PORT || 8799), '127.0.0.1');
MOCK
E2E_MOCK_PORT="$MOCK_PORT" node "$TMP_DIR/mock-telegram.mjs" >"$TMP_DIR/mock.log" 2>&1 &
MOCK_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS "$MOCK_URL/__health" >/dev/null 2>&1; then break; fi
  sleep 0.25
done
if ! curl -fsS "$MOCK_URL/__health" >/dev/null 2>&1; then
  fail "Yerel Telegram mock sunucusu başlamadı"
  exit 1
fi
pass "Telegram sendMessage yerel HTTP mock'u hazır"

if [[ "$RUNTIME" == "worker" ]]; then
  npx wrangler dev --config ./wrangler.jsonc --local --port "$PORT" \
    --var "TELEGRAM_BOT_TOKEN:$FAKE_BOT_TOKEN" \
    --var "TELEGRAM_WEBHOOK_SECRET:$FAKE_WEBHOOK_SECRET" \
    --var "TELEGRAM_ADMIN_CHAT_IDS:$FAKE_ADMIN_CHAT_IDS" \
    --var "TELEGRAM_API_BASE_URL:$MOCK_URL" \
    --var "ADMIN_SESSION_SECRET:local-e2e-admin-secret" \
    >"$TMP_DIR/worker.log" 2>&1 &
else
  npx wrangler pages dev "$PAGES_DIR" --config ./wrangler.jsonc --d1 DB --local --port "$PORT" \
    --binding "TELEGRAM_BOT_TOKEN=$FAKE_BOT_TOKEN" \
    --binding "TELEGRAM_WEBHOOK_SECRET=$FAKE_WEBHOOK_SECRET" \
    --binding "TELEGRAM_ADMIN_CHAT_IDS=$FAKE_ADMIN_CHAT_IDS" \
    --binding "TELEGRAM_API_BASE_URL=$MOCK_URL" \
    --binding "ADMIN_SESSION_SECRET=local-e2e-admin-secret" \
    >"$TMP_DIR/worker.log" 2>&1 &
fi
WORKER_PID=$!

READY=0
for _ in $(seq 1 80); do
  STATUS="$(curl -sS -o "$TMP_DIR/health.json" -w '%{http_code}' "$BASE_URL/api/health" 2>/dev/null || true)"
  if [[ "$STATUS" == "200" ]]; then READY=1; break; fi
  if ! kill -0 "$WORKER_PID" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if (( READY == 0 )); then
  fail "Yerel $RUNTIME sunucusu hazır olmadı (port $PORT)"
  sed -n '1,100p' "$TMP_DIR/worker.log" || true
  exit 1
fi
pass "Yerel $RUNTIME sunucusu hazır (/api/health HTTP 200)"

ORIGIN_HEADER="Origin: $BASE_URL"
CONTENT_HEADER="Content-Type: application/json"
UA_HEADER='User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
TELEGRAM_URL="$BASE_URL/api/telegram"

request_status() {
  local output="$1"; shift
  curl -sS -o "$output" -w '%{http_code}' "$@"
}

NO_SECRET_PAYLOAD='{"message":{"chat":{"id":111,"type":"private"},"text":"/yardim"}}'
STATUS=$(request_status "$TMP_DIR/no-secret.body" -X POST "$TELEGRAM_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" -d "$NO_SECRET_PAYLOAD")
if [[ "$STATUS" == "401" ]]; then pass "Telegram eksik secret -> HTTP 401"; else fail "Telegram eksik secret beklenen 401, alındı $STATUS"; fi

WRONG_SECRET_PAYLOAD='{"message":{"chat":{"id":111,"type":"private"},"text":"/yardim"}}'
STATUS=$(request_status "$TMP_DIR/wrong-secret.body" -X POST "$TELEGRAM_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" -H 'X-Telegram-Bot-Api-Secret-Token: wrong-secret' -d "$WRONG_SECRET_PAYLOAD")
if [[ "$STATUS" == "401" ]]; then pass "Telegram yanlış secret -> HTTP 401"; else fail "Telegram yanlış secret beklenen 401, alındı $STATUS"; fi

MOCK_BEFORE=$(curl -fsS "$MOCK_URL/__messages" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).length)))')
UNAUTHORIZED_PAYLOAD='{"message":{"chat":{"id":999,"type":"private"},"text":"/durum"}}'
STATUS=$(request_status "$TMP_DIR/unauthorized.body" -X POST "$TELEGRAM_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" -H "X-Telegram-Bot-Api-Secret-Token: $FAKE_WEBHOOK_SECRET" -d "$UNAUTHORIZED_PAYLOAD")
MOCK_AFTER=$(curl -fsS "$MOCK_URL/__messages" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).length))')
if [[ "$STATUS" == "200" && "$MOCK_BEFORE" == "$MOCK_AFTER" ]]; then pass "Yetkisiz chat -> sessiz HTTP 200, mock Telegram'a mesaj gitmedi"; else fail "Yetkisiz chat beklenen sessiz 200; status=$STATUS, mock_before=$MOCK_BEFORE, mock_after=$MOCK_AFTER"; fi

send_admin_command() {
  local command="$1" outfile="$2"
  request_status "$outfile" -X POST "$TELEGRAM_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" \
    -H "X-Telegram-Bot-Api-Secret-Token: $FAKE_WEBHOOK_SECRET" \
    -d "{\"message\":{\"chat\":{\"id\":111,\"type\":\"private\"},\"text\":\"$command\"}}"
}

STATUS=$(send_admin_command /yardim "$TMP_DIR/help.body")
HELP_TEXT=$(curl -fsS "$MOCK_URL/__messages" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);process.stdout.write(a.length?a[a.length-1].text:"")})')
if [[ "$STATUS" == "200" && "$HELP_TEXT" == *"Yanımda Türkiye yönetim botu"* && "$HELP_TEXT" == *"/durum"* && "$HELP_TEXT" == *"/yardim"* ]]; then pass "/yardim -> HTTP 200 ve doğru Türkçe yardım mesajı mock ile doğrulandı"; else fail "/yardim cevabı beklenen Türkçe metin değil veya endpoint HTTP 200 dönmedi"; fi

STATUS=$(send_admin_command /durum "$TMP_DIR/status.body")
STATUS_TEXT=$(curl -fsS "$MOCK_URL/__messages" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);process.stdout.write(a.length?a[a.length-1].text:"")})')
if [[ "$STATUS" == "200" && "$STATUS_TEXT" == *"Yanımda Türkiye"* && "$STATUS_TEXT" == *"Son 24 saat"* && "$STATUS_TEXT" == *"Olay sayısı:"* && "$STATUS_TEXT" == *"Hata sayısı:"* ]]; then pass "/durum -> HTTP 200 ve D1 sayımlarını içeren Türkçe cevap mock ile doğrulandı"; else fail "/durum cevabı beklenen Türkçe içerikte değil veya endpoint HTTP 200 dönmedi"; fi

RATE_LIMIT_SEEN=0
for ((attempt=1; attempt<=125; attempt++)); do
  STATUS=$(request_status "$TMP_DIR/rate.body" -X POST "$TELEGRAM_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" \
    -H "X-Telegram-Bot-Api-Secret-Token: $FAKE_WEBHOOK_SECRET" \
    -d '{"message":{"chat":{"id":999,"type":"private"},"text":"/durum"}}')
  if [[ "$STATUS" == "429" ]]; then RATE_LIMIT_SEEN=1; break; fi
  if [[ "$STATUS" != "200" ]]; then break; fi
done
if (( RATE_LIMIT_SEEN == 1 )); then pass "Telegram rate limit aşımı -> HTTP 429"; else fail "Telegram rate limit testinde HTTP 429 alınmadı (son status=$STATUS)"; fi

SESSION_ID="local_e2e_$(date +%s)_$$"
TRACK_BODY="$(printf '{"event":"page_view","consent":true,"session_id":"%s","path":"/local-e2e"}' "$SESSION_ID")"
TRACK_URL="$BASE_URL/api/track"
DELETE_URL="$BASE_URL/api/delete-request"
TRACK_STATUS=$(request_status "$TMP_DIR/track-before.body" -X POST "$TRACK_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" -H "$UA_HEADER" -H 'CF-Connecting-IP: 192.0.2.44' --data "$TRACK_BODY")
if [[ "$TRACK_STATUS" == "204" || "$TRACK_STATUS" == "200" ]]; then pass "Onaylı ilk /api/track -> HTTP $TRACK_STATUS"; else fail "İlk /api/track beklenen 200/204, alındı $TRACK_STATUS"; fi

sql_count() {
  local sql="$1" json_file="$2"
  npx wrangler d1 execute DB --local --config ./wrangler.jsonc --json --command "$sql" >"$json_file"
  node - "$json_file" <<'NODE'
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
function findCount(value) {
  if (Array.isArray(value)) { for (const item of value) { const found = findCount(item); if (found !== null) return found; } }
  else if (value && typeof value === 'object') {
    if (Object.hasOwn(value, 'count')) return Number(value.count);
    for (const item of Object.values(value)) { const found = findCount(item); if (found !== null) return found; }
  }
  return null;
}
const count = findCount(input);
if (count === null || !Number.isFinite(count)) process.exit(2);
process.stdout.write(String(count));
NODE
}

INITIAL_COUNT="$(sql_count "SELECT COUNT(*) AS count FROM events WHERE session_id='$SESSION_ID';" "$TMP_DIR/count-initial.json")"
if [[ "$INITIAL_COUNT" == "1" ]]; then pass "D1: ilk onaylı olay session_id için kaydedildi"; else fail "D1: ilk olay sayısı 1 bekleniyordu, alındı $INITIAL_COUNT"; fi

DELETE_BODY="$(printf '{"session_id":"%s"}' "$SESSION_ID")"
DELETE_STATUS=$(request_status "$TMP_DIR/delete.body" -X POST "$DELETE_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" -H 'CF-Connecting-IP: 192.0.2.44' --data "$DELETE_BODY")
if [[ "$DELETE_STATUS" == "200" ]] && grep -q '"ok":true' "$TMP_DIR/delete.body"; then pass "/api/delete-request -> HTTP 200 ve ok:true"; else fail "/api/delete-request beklenen HTTP 200/ok:true, alındı $DELETE_STATUS"; fi

AFTER_DELETE="$(sql_count "SELECT COUNT(*) AS count FROM events WHERE session_id='$SESSION_ID';" "$TMP_DIR/count-deleted.json")"
REVOKED_COUNT="$(sql_count "SELECT COUNT(*) AS count FROM analytics_session_revocations WHERE session_id='$SESSION_ID';" "$TMP_DIR/count-revoked.json")"
if [[ "$AFTER_DELETE" == "0" && "$REVOKED_COUNT" == "1" ]]; then pass "D1: silme sonrası events=0 ve revocation kaydı=1"; else fail "Silme sonrası beklenen events=0/revocation=1, alındı events=$AFTER_DELETE revoked=$REVOKED_COUNT"; fi

TRACK_AFTER_STATUS=$(request_status "$TMP_DIR/track-after.body" -X POST "$TRACK_URL" -H "$ORIGIN_HEADER" -H "$CONTENT_HEADER" -H "$UA_HEADER" -H 'CF-Connecting-IP: 192.0.2.44' --data "$TRACK_BODY")
AFTER_TRACK_COUNT="$(sql_count "SELECT COUNT(*) AS count FROM events WHERE session_id='$SESSION_ID';" "$TMP_DIR/count-after-track.json")"
if [[ ( "$TRACK_AFTER_STATUS" == "204" || "$TRACK_AFTER_STATUS" == "200" ) && "$AFTER_TRACK_COUNT" == "0" ]]; then pass "İptal sonrası aynı session_id ile /api/track -> HTTP $TRACK_AFTER_STATUS, yeni event yok"; else fail "İptal sonrası /api/track beklenen 200/204 ve events=0; status=$TRACK_AFTER_STATUS count=$AFTER_TRACK_COUNT"; fi

TRIGGER_INSERT_SQL="INSERT INTO events(type,session_id,event,created_at,ts) VALUES('page_view','$SESSION_ID','page_view',datetime('now'),datetime('now'));"
if npx wrangler d1 execute DB --local --config ./wrangler.jsonc --command "$TRIGGER_INSERT_SQL" >"$TMP_DIR/trigger-insert.log" 2>&1; then
  TRIGGER_COUNT="$(sql_count "SELECT COUNT(*) AS count FROM events WHERE session_id='$SESSION_ID';" "$TMP_DIR/count-trigger.json")"
  if [[ "$TRIGGER_COUNT" == "0" ]]; then pass "0004 trigger: iptal edilmiş session_id için doğrudan INSERT engellendi"; else fail "0004 trigger INSERT'i engellemedi; events count=$TRIGGER_COUNT"; fi
else
  fail "0004 trigger doğrudan INSERT denemesi SQL hatası verdi"
fi

if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_TEST_CHAT_ID:-}" ]]; then
  info "İsteğe bağlı gerçek Telegram testi başlatılıyor (gizli değerler yazdırılmaz)"
  if node --input-type=module <<'REAL_BOT'
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_TEST_CHAT_ID;
try {
  const base = `https://api.telegram.org/bot${token}`;
  const me = await fetch(`${base}/getMe`, {signal: AbortSignal.timeout(10000)});
  const meBody = await me.json();
  if (!me.ok || meBody?.ok !== true) throw new Error('getMe_failed');
  const sent = await fetch(`${base}/sendMessage`, {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({chat_id: chatId, text: 'Yanımda Türkiye yerel E2E test mesajı.'}),
    signal: AbortSignal.timeout(10000),
  });
  const sentBody = await sent.json();
  if (!sent.ok || sentBody?.ok !== true) throw new Error('sendMessage_failed');
  process.exit(0);
} catch {
  process.exit(1);
}
REAL_BOT
  then pass "Gerçek Telegram getMe + sendMessage başarılı"; else fail "Gerçek Telegram getMe/sendMessage başarısız (gizli değerler gösterilmedi)"; fi
else
  info "Gerçek Telegram testi atlandı: TELEGRAM_BOT_TOKEN ve TELEGRAM_TEST_CHAT_ID birlikte tanımlı değil"
fi

if (( FAILURES > 0 )); then exit 1; fi
