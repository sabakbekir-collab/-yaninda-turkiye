#!/usr/bin/env bash
set +x
set -Eeuo pipefail

usage() {
  printf 'Kullanım: %s {set|info|delete}\n' "${0##*/}" >&2
  exit 2
}

fail() {
  printf 'Hata: %s\n' "$1" >&2
  exit 1
}

command_name=${1:-}
[[ $# -eq 1 ]] || usage

: "${TELEGRAM_BOT_TOKEN:?Hata: TELEGRAM_BOT_TOKEN ortam değişkeni eksik.}" || exit 1
: "${TELEGRAM_WEBHOOK_SECRET:?Hata: TELEGRAM_WEBHOOK_SECRET ortam değişkeni eksik.}" || exit 1
: "${SITE_URL:?Hata: SITE_URL ortam değişkeni eksik.}" || exit 1

[[ "$TELEGRAM_BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]] || fail 'TELEGRAM_BOT_TOKEN biçimi geçersiz.'
[[ "$TELEGRAM_WEBHOOK_SECRET" =~ ^[A-Za-z0-9_-]{1,256}$ ]] || fail 'TELEGRAM_WEBHOOK_SECRET biçimi geçersiz.'
[[ "$SITE_URL" =~ ^https://[^/]+(/.*)?$ ]] || fail 'SITE_URL https:// ile başlayan geçerli bir adres olmalı.'

api="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

case "$command_name" in
  set)
    webhook_url="${SITE_URL%/}/api/telegram"
    response=$(curl --silent --show-error --fail \
      --output - --write-out '\n' \
      --request POST "${api}/setWebhook" \
      --data-urlencode "url=${webhook_url}" \
      --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
      --data-urlencode 'allowed_updates=["message"]' 2>/dev/null) \
      || fail 'Telegram setWebhook isteği başarısız oldu; gizli değerler gösterilmedi.'
    printf '%s\n' "$response"
    ;;
  info)
    response=$(curl --silent --show-error --fail \
      --get "${api}/getWebhookInfo" 2>/dev/null) \
      || fail 'Telegram getWebhookInfo isteği başarısız oldu; gizli değerler gösterilmedi.'
    if command -v jq >/dev/null 2>&1; then
      printf '%s\n' "$response" | jq '{ok, result: {url: .result.url, has_custom_certificate: .result.has_custom_certificate, pending_update_count: .result.pending_update_count, last_error_date: .result.last_error_date, last_error_message: .result.last_error_message, max_connections: .result.max_connections, allowed_updates: .result.allowed_updates}}'
    else
      printf '%s\n' "$response"
    fi
    ;;
  delete)
    response=$(curl --silent --show-error --fail \
      --request POST "${api}/deleteWebhook" 2>/dev/null) \
      || fail 'Telegram deleteWebhook isteği başarısız oldu; gizli değerler gösterilmedi.'
    printf '%s\n' "$response"
    ;;
  *)
    usage
    ;;
esac
