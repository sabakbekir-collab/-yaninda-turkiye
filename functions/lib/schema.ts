import type { Env } from './types';

let ready: Promise<void> | null = null;

export function ensureSchema(env: Env): Promise<void> {
  if (!env.DB) return Promise.resolve();
  if (ready) return ready;

  ready = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        metadata TEXT,
        city TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at)`,
      `CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        phone TEXT NOT NULL,
        whatsapp TEXT,
        address TEXT NOT NULL,
        province TEXT NOT NULL,
        district TEXT NOT NULL,
        description TEXT,
        hours TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, created_at)`,
      `CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id TEXT NOT NULL,
        place_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at)`,
      `CREATE TABLE IF NOT EXISTS ads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        text TEXT,
        image_url TEXT,
        target_url TEXT,
        placement TEXT NOT NULL DEFAULT 'home_top',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ads_placement_status ON ads(placement, status, updated_at)`,
      `CREATE TABLE IF NOT EXISTS api_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at)`,
    ];

    for (const sql of statements) {
      await env.DB!.prepare(sql).run();
    }
  })().catch((error) => {
    ready = null;
    throw error;
  });

  return ready;
}
