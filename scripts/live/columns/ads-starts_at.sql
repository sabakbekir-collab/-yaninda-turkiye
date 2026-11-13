-- canlıda eksik: fixture'da ads tanımında starts_at yok (live-schema.sql satır 6).
-- SQLite/D1 does not support ADD COLUMN IF NOT EXISTS; apply once only.
ALTER TABLE ads ADD COLUMN starts_at TEXT;
