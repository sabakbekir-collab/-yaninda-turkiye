# Live schema comparison status

**NOT RUN / BLOCKED:** The PR branch does not contain repository-root `live-schema.sql`. Per instruction, the automated comparison against that file is skipped rather than synthesizing an incomplete schema.

The operator-provided Cloudflare Console output showed these tables: `_cf_KV`, `admin_logs`, `ads`, `api_cache`, `events`, `reports`, `sqlite_sequence`, `submissions`.

The supplied CREATE TABLE definitions match the table/column definitions in migrations 0001 and 0002 at a high level. This is not a complete PASS: the shared output did not include separate index/trigger definitions, and there is no migration ledger. The earlier `d1_migrations` query returned no such table.

Do not infer that 0001/0002 were historically applied by Wrangler. Do not apply migrations 0001/0002 to live. Before any live rollout, obtain a complete schema-only export and compare tables, columns, indexes, and triggers in an isolated local D1.
