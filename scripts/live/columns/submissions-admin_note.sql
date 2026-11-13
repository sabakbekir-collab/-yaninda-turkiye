-- One-time additive change. Check PRAGMA table_info(submissions) first.
-- SQLite/D1 has no ADD COLUMN IF NOT EXISTS; do not rerun if the column exists.
ALTER TABLE submissions ADD COLUMN admin_note TEXT;
