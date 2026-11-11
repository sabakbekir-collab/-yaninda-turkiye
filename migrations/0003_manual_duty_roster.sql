CREATE TABLE IF NOT EXISTS manual_duty_rosters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province TEXT NOT NULL,
  province_slug TEXT NOT NULL,
  duty_date TEXT NOT NULL,
  source_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(province_slug,duty_date)
);

CREATE TABLE IF NOT EXISTS manual_duty_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roster_id INTEGER NOT NULL REFERENCES manual_duty_rosters(id) ON DELETE CASCADE,
  district_slug TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manual_duty_entries_roster ON manual_duty_entries(roster_id,district_slug);

CREATE TABLE IF NOT EXISTS telegram_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS telegram_link_attempts (
  chat_id TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
CREATE INDEX IF NOT EXISTS idx_telegram_link_attempts_window ON telegram_link_attempts(window_started_at);

CREATE TABLE IF NOT EXISTS telegram_pending_rosters (
  chat_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roster_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  province TEXT,
  duty_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_roster_events_created ON roster_events(created_at);