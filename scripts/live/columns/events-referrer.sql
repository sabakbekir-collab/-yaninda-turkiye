-- canlıda eksik: fixture'da events tanımında referrer yok (live-schema.sql satır 8).
-- SQLite/D1 does not support ADD COLUMN IF NOT EXISTS; apply once only.
ALTER TABLE events ADD COLUMN referrer TEXT;
