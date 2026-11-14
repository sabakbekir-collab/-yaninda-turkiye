#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

if [[ "${1:-}" == "--dry-run" ]]; then
  cat <<'PLAN'
DRY-RUN: hiçbir komut çalıştırılmayacak; canlı veritabanına, ağa veya Telegram'a erişilmeyecek.
PLAN
  printf '%s\n' \
    'PLAN a) node/npm/wrangler, wrangler whoami, GO_LIVE_CONFIRM, branch ve git status kontrolleri' \
    'PLAN b) DB_TARGET=remote go-live.sh preflight; çıktıyı göster; EVET onayı iste' \
    'PLAN c) go-live.sh apply; ardından verify; verify başarısızsa rollback.md yönergesi' \
    'PLAN d) PR #32 merge/deploy için kullanıcıyı beklet; deploy yöntemini açıkla' \
    'PLAN e) SITE_URL ile smoke.sh' \
    'PLAN f) eksik Telegram token/secret değerlerini terminalde sessiz al; webhook set ve info; son_error kontrolü' \
    'PLAN g) /durum, /yardim, yetkisiz hesap ve BotFather manuel kontrollerini listele'
  exit 0
fi

[[ $# -eq 0 ]] || fail 'Kullanım: bash scripts/live/finish.sh [--dry-run]'

TMP_DIR="$(mktemp -d)"
cleanup() {
  unset TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT HUP INT TERM

# a) Local operator preconditions. No credential values are printed.
for bin in node npm wrangler git; do
  command -v "$bin" >/dev/null 2>&1 || fail "Ön kontrol: $bin bulunamadı"
done
pass 'Ön kontrol: node, npm, wrangler ve git mevcut'

if ! wrangler whoami >/dev/null 2>&1; then
  fail 'Ön kontrol: Wrangler oturumu doğrulanamadı; wrangler login gerekli'
fi
pass 'Ön kontrol: Wrangler oturumu doğrulandı'

[[ "${GO_LIVE_CONFIRM+x}" != x ]] || fail 'Ön kontrol: GO_LIVE_CONFIRM tanımlı; önce unset GO_LIVE_CONFIRM çalıştır'
pass 'Ön kontrol: GO_LIVE_CONFIRM tanımsız'

branch="$(git branch --show-current)"
[[ "$branch" == "feat/admin-analytics-ux-kvkk" ]] || fail 'Ön kontrol: PR #32 dalında değilsin'
if [[ -n "$(git status --porcelain)" ]]; then
  fail 'Ön kontrol: git çalışma ağacı temiz değil'
fi
pass 'Ön kontrol: doğru dal ve temiz git çalışma ağacı'

# b) Read-only preflight (it also creates and validates a local backup file).
printf '%s\n' 'INFO Preflight çıktısı:'
if DB_TARGET=remote bash scripts/live/go-live.sh preflight >"$TMP_DIR/preflight.out" 2>&1; then
  cat "$TMP_DIR/preflight.out"
  pass 'Canlı D1 preflight ve yedek kontrolü'
else
  cat "$TMP_DIR/preflight.out"
  fail 'Canlı D1 preflight başarısız; apply yapılmadı'
fi

printf '%s' 'Şema apply için açık onay: EVET yazın: '
IFS= read -r approval
[[ "$approval" == "EVET" ]] || fail 'Açık EVET onayı verilmedi; apply yapılmadı'
pass 'Operatör EVET onayı verdi'

# c) Apply then verify. Never attempt an automatic destructive rollback.
if GO_LIVE_CONFIRM=EVET DB_TARGET=remote bash scripts/live/go-live.sh apply; then
  pass 'Canlı D1 additive apply'
else
  fail 'Canlı D1 apply başarısız; durduruldu. scripts/live/rollback.md yönergesini incele'
fi

if DB_TARGET=remote bash scripts/live/go-live.sh verify; then
  pass 'Canlı D1 verify'
else
  printf '%s\n' 'FAIL Canlı D1 verify başarısız.' >&2
  printf '%s\n' 'DUR: deploy/merge yapma. scripts/live/rollback.md dosyasını incele; otomatik rollback uygulanmadı.' >&2
  exit 1
fi

# d) The operator performs merge/deploy manually. Never merge or deploy here.
printf '\n%s\n' 'GitHub üzerinden PR #32 merge işlemini yap ve deploy tamamlanana kadar bekle.'
printf '%s\n' 'Deploy yöntemi tespiti: wrangler.jsonc Worker adını ve D1 binding bilgisini tanımlar; Workers Builds bağlantı durumunu içermez.'
if [[ -f .github/workflows/cloudflare-deploy.yml ]] && grep -q 'CLOUDFLARE_API_TOKEN' .github/workflows/cloudflare-deploy.yml; then
  printf '%s\n' 'GitHub Actions deploy workflow CLOUDFLARE_API_TOKEN secret gerektiriyor. Secret silindiği için bu yöntem şu anda deploy edemez.'
fi
printf '%s\n' 'Cloudflare Workers Builds etkinliği yalnızca Cloudflare Dashboard > Workers & Pages > yaninda-turkiye > Settings > Builds bölümünden doğrulanabilir.'
printf '%s\n' 'Workers Builds bağlıysa merge sonrası otomatik deploy beklenir. Bağlı değilse, operatör onayıyla bilgisayarda npx wrangler deploy --config ./wrangler.jsonc komutu kullanılabilir.'
printf '%s' 'Deploy tamamlandıktan sonra devam etmek için Enter tuşuna basın: '
IFS= read -r _

# e) Production smoke tests.
if SITE_URL=https://yaninda-turkiye.sabakbekir.workers.dev bash scripts/live/smoke.sh; then
  pass 'Production smoke test'
else
  fail 'Production smoke test başarısız; durduruldu, önceki deploy ve rollback prosedürünü incele'
fi

# f) Telegram credentials are read only into shell memory, never echoed or written to disk.
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  IFS= read -rs -p 'Telegram bot token (gizli): ' TELEGRAM_BOT_TOKEN
  printf '\n'
  export TELEGRAM_BOT_TOKEN
fi
if [[ -z "${TELEGRAM_WEBHOOK_SECRET:-}" ]]; then
  IFS= read -rs -p 'Telegram webhook secret (gizli): ' TELEGRAM_WEBHOOK_SECRET
  printf '\n'
  export TELEGRAM_WEBHOOK_SECRET
fi
export SITE_URL=https://yaninda-turkiye.sabakbekir.workers.dev

if bash scripts/telegram-webhook.sh set >"$TMP_DIR/telegram-set.out" 2>&1; then
  if node - "$TMP_DIR/telegram-set.out" <<'NODE'
const fs = require('node:fs');
try {
  const s = fs.readFileSync(process.argv[2], 'utf8').trim();
  const j = JSON.parse(s);
  process.exit(j.ok === true ? 0 : 1);
} catch { process.exit(1); }
NODE
  then
    pass 'Telegram webhook set'
  else
    fail 'Telegram setWebhook yanıtı doğrulanamadı; yanıt içeriği gizlendi'
  fi
else
  fail 'Telegram webhook set başarısız; yanıt içeriği gizlendi'
fi

if bash scripts/telegram-webhook.sh info >"$TMP_DIR/telegram-info.out" 2>&1; then
  if node - "$TMP_DIR/telegram-info.out" <<'NODE'
const fs = require('node:fs');
try {
  const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const r = j.result || {};
  process.exit(j.ok === true && (!r.last_error_message || r.last_error_message === '') ? 0 : 1);
} catch { process.exit(1); }
NODE
  then
    pass 'Telegram webhook info: last_error_message boş'
  else
    fail 'Telegram webhook info doğrulaması başarısız veya last_error_message dolu; yanıt içeriği gizlendi'
  fi
else
  fail 'Telegram webhook info isteği başarısız; yanıt içeriği gizlendi'
fi
unset TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET
pass 'Telegram gizli değişkenleri unset edildi'

# g) Manual bot checks. No chat messages are sent by this script.
cat <<'MANUAL'
MANUEL TELEGRAM KONTROLLERİ:
1. BotFather: /setcommands ile durum - Sistem durumu ve yardim - Komut yardımı tanımla.
2. Yetkili hesaptan bota /durum ve /yardim gönder; yanıtları doğrula.
3. Yetkisiz bir hesaptan komut gönder; bot sessiz kalmalı.
4. Yeni token ve bot doğrulandıktan sonra BotFather üzerinden eski token için /revoke uygula.
5. Bu kontrolleri tamamlamadan entegrasyonu tamamlandı olarak işaretleme.
MANUAL
pass 'Otomatik adımlar bitti; BotFather ve sohbet kontrolleri manuel bekliyor'
