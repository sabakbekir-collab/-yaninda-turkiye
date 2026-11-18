-- Additive, idempotent duty roster schema. Apply manually in production only.
CREATE TABLE IF NOT EXISTS duty_pharmacies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duty_date TEXT NOT NULL,
  province TEXT NOT NULL,
  district TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(duty_date, province, district, name)
);
CREATE INDEX IF NOT EXISTS idx_duty_pharmacies_date_area ON duty_pharmacies(duty_date, province, district);
CREATE TABLE IF NOT EXISTS duty_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  source TEXT NOT NULL,
  province_count INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_kind TEXT
);