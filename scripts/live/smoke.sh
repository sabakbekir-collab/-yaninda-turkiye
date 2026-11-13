#!/usr/bin/env bash
set -euo pipefail
set +x
: "${SITE_URL:?SITE_URL gerekli}"
SITE_URL="${SITE_URL%/}"
if [[ "$SITE_URL" =~ ^https://[^/]+$ ]]; then
  :
elif [[ "${ALLOW_LOCAL_HTTP:-0}" == "1" ]]; then
  case "$SITE_URL" in
    http://127.0.0.1|http://127.0.0.1:*|http://localhost|http://localhost:*) ;;
    *) echo 'FAIL SITE_URL'; exit 2 ;;
  esac
else
  echo 'FAIL SITE_URL'; exit 2
fi
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
pass=0; fail=0
check(){
 local name="$1" want="$2" method="$3" path="$4" data="${5:-}" status ok=0
 if [ "$method" = POST ]; then status="$(curl -sS --max-time 20 -o "$tmp/body" -w '%{http_code}' -X POST "$SITE_URL$path" -H 'Content-Type: application/json' -H "Origin: $SITE_URL" -H 'Sec-Fetch-Site: same-origin' --data "$data" 2>/dev/null || true)"
 else status="$(curl -sS --max-time 20 -o "$tmp/body" -w '%{http_code}' -X "$method" "$SITE_URL$path" 2>/dev/null || true)"; fi
 [ "$status" = "$want" ] && ok=1
 if [ "$name" = health ]; then grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$tmp/body" && grep -Eq '"database"[[:space:]]*:[[:space:]]*true' "$tmp/body" || ok=0; fi
 if [ "$ok" -eq 1 ]; then printf 'PASS %-30s %s\n' "$name" "$status"; pass=$((pass+1)); else printf 'FAIL %-30s expected=%s got=%s\n' "$name" "$want" "${status:-000}"; fail=$((fail+1)); fi
}
check health 200 GET /api/health
check homepage 200 GET /
check ads 200 GET /api/ads
check admin-analytics 401 GET /api/admin/analytics
check telegram-no-secret 401 POST /api/telegram '{"message":{"chat":{"id":1,"type":"private"},"text":"/yardim"}}'
check track-invalid-body 400 POST /api/track '{}'
check robots 200 GET /robots.txt
check sitemap 200 GET /sitemap.xml
printf 'SUMMARY PASS=%s FAIL=%s\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
