-- canlıda eksik: fixture'da events tanımında ip_hash yok (live-schema.sql satır 8).
-- SQLite/D1 does not support ADD COLUMN IF NOT EXISTS; apply once only.
ALTER TABLE events ADD COLUMN ip_hash TEXT;
