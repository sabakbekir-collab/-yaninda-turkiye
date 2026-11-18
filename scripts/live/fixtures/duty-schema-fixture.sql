-- Minimal local CI fixture representing the currently reported live schema (duty tables absent).
-- This is a test fixture only; it is not a live export.
CREATE TABLE IF NOT EXISTS api_cache(cache_key TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,type TEXT NOT NULL,metadata TEXT,city TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,phone TEXT NOT NULL,whatsapp TEXT,address TEXT NOT NULL,province TEXT NOT NULL,district TEXT NOT NULL,description TEXT,hours TEXT,status TEXT DEFAULT 'pending',latitude REAL,longitude REAL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,place_id TEXT NOT NULL,place_name TEXT NOT NULL,reason TEXT NOT NULL,details TEXT,status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP,resolved_at TEXT);
CREATE TABLE IF NOT EXISTS admin_logs(id INTEGER PRIMARY KEY,action TEXT NOT NULL,target_id INTEGER,detail TEXT,ip TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
