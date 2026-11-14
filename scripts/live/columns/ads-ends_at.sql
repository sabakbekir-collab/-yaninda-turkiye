-- canlıda eksik: fixture'da ads tanımında ends_at yok (live-schema.sql satır 6).
-- SQLite/D1 does not support ADD COLUMN IF NOT EXISTS; apply once only.
ALTER TABLE ads ADD COLUMN ends_at TEXT;
