-- canlıda eksik: live-schema.sql satır 8 tablosu events sütun listesinde event yok.
-- Source snapshot: scripts/live/fixtures/live-schema.sql; verified against captured CREATE TABLE at line 8.
ALTER TABLE events ADD COLUMN event TEXT;
