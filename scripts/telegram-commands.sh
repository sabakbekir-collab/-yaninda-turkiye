#!/usr/bin/env bash
set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN ortam değişkeni gerekli}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
chmod 700 "$tmp_dir"

cat >"$tmp_dir/commands.json" <<'JSON'
{"commands":[
 {"command":"start","description":"Yönetim botunu başlat"},
 {"command":"yardim","description":"Komut listesini göster"},
 {"command":"durum","description":"Son 24 saat sistem özeti"},
 {"command":"basvurular","description":"Bekleyen son 10 başvuru"},
 {"command":"basvuru","description":"Başvuru ayrıntı özeti"},
 {"command":"onayla","description":"Başvuru onayı iste"},
 {"command":"reddet","description":"Başvuru reddi iste"},
 {"command":"evet","description":"Bekleyen işlemi onayla"},
 {"command":"bildirimler","description":"Açık hatalı bildirimler"},
 {"command":"rapor","description":"24 saat ve 7 günlük rapor"},
 {"command":"sessiz","description":"Bildirimleri geçici sustur"},
 {"command":"ac","description":"Bildirimleri yeniden aç"},
 {"command":"saglik","description":"Sistem sağlık kontrolü"},
 {"command":"nobet","description":"İl veya ilçe nöbetçi eczaneleri"},
 {"command":"nobetrapor","description":"Nöbet veri senkron özeti"},
 {"command":"nobetsenk","description":"Elle nöbet senkronu iste"}
]}
JSON

cat >"$tmp_dir/curl.conf" <<EOF
url = "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands"
request = "POST"
header = "Content-Type: application/json"
data-binary = "@$tmp_dir/commands.json"
silent
show-error
fail
output = "/dev/null"
EOF
chmod 600 "$tmp_dir/curl.conf"
curl --config "$tmp_dir/curl.conf"
printf '%s\n' "Telegram komut menüsü başarıyla kaydedildi."
