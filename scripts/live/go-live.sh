#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
DB_NAME=yaninda-turkiye-db
DB_TARGET="${DB_TARGET:-remote}"
CONFIG="${WRANGLER_CONFIG:-./wrangler.jsonc}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
BACKUP="$BACKUP_DIR/backup-$(date +%F).sql"
die(){ printf 'FAIL %s\n' "$1" >&2; exit 1; }
pass(){ printf 'PASS %s\n' "$1"; }
[ "$#" -eq 1 ] || die "Kullanım: go-live.sh preflight|apply|verify"
ACTION="$1"
case "$ACTION" in preflight|apply|verify) ;; *) die "Geçersiz komut" ;; esac
[ "$DB_TARGET" = remote ] || [ "$DB_TARGET" = local ] || die "DB_TARGET remote/local olmalı"
[ -f "$CONFIG" ] || die "Wrangler config bulunamadı"
if ! command -v npx >/dev/null || ! command -v node >/dev/null; then die "npx ve node gerekli"; fi
if grep -RniE 'wrangler[[:space:]]+d1[[:space:]]+migrations[[:space:]]+apply' scripts/live --include='*.sh' --exclude='go-live.sh' >/dev/null 2>&1; then die "Yasak migration runner komutu bulundu"; fi
if [ "$DB_TARGET" = remote ]; then
  grep -Eq '"database_name"[[:space:]]*:[[:space:]]*"yaninda-turkiye-db"' "$CONFIG" || die "Yalnızca yaninda-turkiye-db hedeflenebilir"
  grep -Eq '"database_id"[[:space:]]*:[[:space:]]*"3edba257-0694-4b38-adb4-865e4aa9dac4"' "$CONFIG" || die "Production DB ID eşleşmiyor"
fi
d1(){ if [ "$DB_TARGET" = remote ]; then npx --yes wrangler@4 d1 execute "$DB_NAME" --remote "$@"; else npx --yes wrangler@4 d1 execute "$DB_NAME" --local --config "$CONFIG" "$@"; fi; }
has_col(){
  local out
  out="$(d1 --command "PRAGMA table_info($1);" 2>/dev/null)" || die "PRAGMA okunamadı"
  printf '%s\n' "$out" | grep -Eiq "(^|[|[:space:]])$2([|[:space:]]|$)"
}
columns(){ printf '%s\n' events:ts events:session_id events:user_id events:event events:path events:target_type events:target_id events:target_label events:props_json events:device events:browser events:referrer events:ip_hash ads:starts_at ads:ends_at submissions:admin_note; }
preflight(){
 if [ "$DB_TARGET" = remote ]; then
  npx --yes wrangler@4 whoami >/dev/null 2>&1 || die "Wrangler login doğrulanamadı"
  mkdir -p "$BACKUP_DIR"
  npx --yes wrangler@4 d1 export "$DB_NAME" --remote --output "$BACKUP" >/dev/null 2>&1 || die "D1 export başarısız (çıktı gizlendi)"
  [ -s "$BACKUP" ] || die "Yedek boş"
  grep -Eqi 'CREATE[[:space:]]+TABLE' "$BACKUP" || die "Yedekte CREATE TABLE yok"
  grep -Fq '/backups/' .gitignore || die ".gitignore /backups/ içermiyor"
  pass "Yedek alındı ve doğrulandı (içerik gizli)"
 else printf 'INFO Yerel mod: export/login atlandı\n'; fi
 while IFS=: read -r t c; do
  if has_col "$t" "$c"; then printf 'ZATEN VAR %s.%s\n' "$t" "$c"; else printf 'EKLENECEK %s.%s\n' "$t" "$c"; fi
 done < <(columns)
}
apply(){
 preflight
 answer="${GO_LIVE_CONFIRM:-}"
 if [ -z "$answer" ]; then read -r -p 'Şema değişikliği için EVET yazın: ' answer; fi
 [ "$answer" = EVET ] || die "Onay verilmedi"
 for f in scripts/live/columns/*.sql; do
  b="$(basename "$f")"
  case "$b" in events-*.sql) t=events; c="${b#events-}";; ads-*.sql) t=ads; c="${b#ads-}";; submissions-*.sql) t=submissions; c="${b#submissions-}";; *) die "Beklenmeyen ALTER dosyası";; esac
  c="${c%.sql}"
  if has_col "$t" "$c"; then printf 'SKIP %s.%s\n' "$t" "$c"; else d1 --file "$f" >/dev/null; has_col "$t" "$c" || die "ALTER sonrası doğrulama başarısız"; fi
 done
 d1 --file scripts/live/apply-0003-0004.sql >/dev/null
 pass "Şema eklemeleri uygulandı"
}
verify(){
 raw="$(d1 --json --file scripts/live/verify.sql 2>/dev/null)" || die "verify.sql başarısız"
 printf '%s' "$raw" | node --input-type=module -e '
let s=""; for await (const c of process.stdin) s+=c; const j=JSON.parse(s), a=[];
function w(x){if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object"){if(typeof x.check_name==="string"&&"ok" in x)a.push(x);Object.values(x).forEach(w)}}
w(j); const bad=a.filter(x=>Number(x.ok)!==1);
if(a.length!==27||bad.length){console.error("FAIL schema checks "+a.length+"/27");process.exit(1)}
console.log("PASS 27/27 schema checks")
'
}
case "$ACTION" in preflight) preflight;; apply) apply;; verify) verify;; esac
