-- Read-only schema snapshot captured from Cloudflare D1 sqlite_master.
-- Source: user-provided SELECT type, name, sql output; no row data is included.
-- This fixture is the sole baseline for PR #32 live-schema comparison.
CREATE TABLE _cf_KV ( key TEXT PRIMARY KEY, value BLOB ) WITHOUT ROWID;
CREATE TABLE admin_logs ( id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, target_id INTEGER, detail TEXT, ip TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE ads ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, text TEXT, image_url TEXT, target_url TEXT, placement TEXT NOT NULL DEFAULT 'home_top', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE api_cache ( cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at TEXT NOT NULL );
CREATE TABLE events ( id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, metadata TEXT, city TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE reports ( id INTEGER PRIMARY KEY AUTOINCREMENT, place_id TEXT NOT NULL, place_name TEXT NOT NULL, reason TEXT NOT NULL, details TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT );
CREATE TABLE submissions ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, phone TEXT NOT NULL, whatsapp TEXT, address TEXT NOT NULL, province TEXT NOT NULL, district TEXT NOT NULL, description TEXT, hours TEXT, status TEXT NOT NULL DEFAULT 'pending', latitude REAL, longitude REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE INDEX idx_admin_logs_created ON admin_logs(created_at);
CREATE INDEX idx_ads_placement_status ON ads(placement, status, updated_at);
CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);
CREATE INDEX idx_events_type_created ON events(type, created_at);
CREATE INDEX idx_reports_status ON reports(status, created_at);
CREATE INDEX idx_submissions_status ON submissions(status, created_at);
