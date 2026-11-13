-- One-time additive change. Check PRAGMA table_info(ads) first.
-- SQLite/D1 has no ADD COLUMN IF NOT EXISTS; do not rerun if the column exists.
ALTER TABLE ads ADD COLUMN ends_at TEXT;
