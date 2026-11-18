#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${YANINDA_BASE_URL:-https://yaninda-turkiye.sabakbekir.workers.dev}"
HEALTH="$(curl --silent --show-error --fail "$BASE_URL/api/health")"
node --input-type=module - "$HEALTH" <<'NODE'
const value = JSON.parse(process.argv[2]);
if (value.ok !== true || value.database !== true) process.exit(1);
NODE
printf '%s\n' "Yanımda Türkiye health smoke başarılı."
