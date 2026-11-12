#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-live}"
REPORT="$ROOT/d1-audit-report.txt"
LIVE_DB="yaninda-turkiye-db"
PREVIEW_DB="yaninda-turkiye-preview-db"

case "$MODE" in
  live) TARGETS=("$LIVE_DB") ;;
  preview) TARGETS=("$LIVE_DB" "$PREVIEW_DB") ;;
  *)
    printf 'Kullanım: bash scripts/d1-readonly-audit.sh [preview]\n' >&2
    exit 2
    ;;
esac

for command_name in npx node; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'Gerekli komut bulunamadı: %s\n' "$command_name" >&2
    exit 1
  }
done

# SQL allowlist: only the exact schema/migration reads below are accepted.
assert_readonly_sql() {
  local sql="$1"
  case "$sql" in
    "SELECT name FROM d1_migrations ORDER BY id")
      return 0
      ;;
    "SELECT name FROM sqlite_master WHERE type IN ('table','trigger','index') ORDER BY name")
      return 0
      ;;
    PRAGMA\ table_info\([A-Za-z_][A-Za-z0-9_]*\))
      return 0
      ;;
    *)
      printf 'Allowlist dışı SQL reddedildi.\n' >&2
      return 1
      ;;
  esac
}

run_sql() {
  local database="$1" sql="$2" output_file="$3"
  assert_readonly_sql "$sql"
  npx wrangler d1 execute "$database" --remote --config ./wrangler.jsonc --json --command "$sql" >"$output_file"
}

extract_names() {
  node --input-type=module - "$1" <<'NODE'
import fs from 'node:fs';
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const names = new Set();
function visit(value) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item);
  } else if (value && typeof value === 'object') {
    if (typeof value.name === 'string') names.add(value.name);
    for (const item of Object.values(value)) visit(item);
  }
}
visit(input);
for (const name of names) process.stdout.write(name + '\n');
NODE
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
: >"$REPORT"

audit_database() {
  local database="$1" label="$2" prefix="$3"
  local migration_json="$TMP_DIR/$prefix-migrations.json"
  local object_json="$TMP_DIR/$prefix-objects.json"
  local migration_list="$TMP_DIR/$prefix-migration-list.txt"
  local object_list="$TMP_DIR/$prefix-object-list.txt"
  local schema_file="$TMP_DIR/$prefix-schema.txt"
  local table

  {
    printf '\n===== %s (%s) =====\n' "$label" "$database"
    printf '\n-- Wrangler migration list (read-only) --\n'
  } | tee -a "$REPORT"

  npx wrangler d1 migrations list "$database" --remote --config ./wrangler.jsonc 2>&1 | tee "$migration_list" | tee -a "$REPORT"

  printf '\n-- d1_migrations names --\n' | tee -a "$REPORT"
  run_sql "$database" "SELECT name FROM d1_migrations ORDER BY id" "$migration_json"
  tee -a "$REPORT" <"$migration_json"
  extract_names "$migration_json" >"$TMP_DIR/$prefix-migration-names.txt"

  printf '\n-- sqlite_master object names (table/trigger/index) --\n' | tee -a "$REPORT"
  run_sql "$database" "SELECT name FROM sqlite_master WHERE type IN ('table','trigger','index') ORDER BY name" "$object_json"
  tee -a "$REPORT" <"$object_json"
  extract_names "$object_json" >"$object_list"

  : >"$schema_file"
  printf '\n-- PRAGMA table_info for each sqlite_master name --\n' | tee -a "$REPORT"
  while IFS= read -r table; do
    [[ -n "$table" ]] || continue
    if [[ ! "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      printf 'Güvenli olmayan SQLite nesne adı atlandı.\n' | tee -a "$REPORT"
      continue
    fi
    printf '\n### %s\n' "$table" | tee -a "$REPORT"
    run_sql "$database" "PRAGMA table_info($table)" "$TMP_DIR/$prefix-pragma.json"
    { printf '%s\n' "$table"; cat "$TMP_DIR/$prefix-pragma.json"; } >>"$schema_file"
    tee -a "$REPORT" <"$TMP_DIR/$prefix-pragma.json"
  done <"$object_list"

  cp "$migration_list" "$TMP_DIR/$prefix-wrangler-migrations.txt"
}

for index in "${!TARGETS[@]}"; do
  database="${TARGETS[$index]}"
  if [[ "$database" == "$LIVE_DB" ]]; then label="LIVE READ-ONLY"; else label="EXISTING PREVIEW READ-ONLY"; fi
  audit_database "$database" "$label" "db-$index"
done

if [[ "$MODE" == "preview" ]]; then
  {
    printf '\n===== LIVE vs EXISTING PREVIEW: migration-list comparison =====\n'
    diff -u "$TMP_DIR/db-0-wrangler-migrations.txt" "$TMP_DIR/db-1-wrangler-migrations.txt" || true
    printf '\n===== LIVE vs EXISTING PREVIEW: applied migration-name comparison =====\n'
    diff -u "$TMP_DIR/db-0-migration-names.txt" "$TMP_DIR/db-1-migration-names.txt" || true
    printf '\n===== LIVE vs EXISTING PREVIEW: schema comparison =====\n'
    diff -u "$TMP_DIR/db-0-schema.txt" "$TMP_DIR/db-1-schema.txt" || true
  } | tee -a "$REPORT"
fi

printf '\nRapor yazıldı: %s\n' "$REPORT"
