-- One-time additive change. Check PRAGMA table_info(events) first.
-- SQLite/D1 has no ADD COLUMN IF NOT EXISTS; do not rerun if the column exists.
ALTER TABLE events ADD COLUMN referrer TEXT;
