-- canlıda eksik: fixture'da submissions tanımında admin_note yok (live-schema.sql satır 10).
-- SQLite/D1 does not support ADD COLUMN IF NOT EXISTS; apply once only.
ALTER TABLE submissions ADD COLUMN admin_note TEXT;
