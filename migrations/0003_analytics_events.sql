-- The base schema (0001_init.sql) already defines events.city; this migration reuses it.
-- New accepted-consent events populate city from Cloudflare request.cf.city (region fallback).
-- Expand the existing events table without dropping legacy analytics data.
ALTER TABLE events ADD COLUMN ts TEXT;
ALTER TABLE events ADD COLUMN session_id TEXT;
ALTER TABLE events ADD COLUMN user_id TEXT;
ALTER TABLE events ADD COLUMN event TEXT;
ALTER TABLE events ADD COLUMN path TEXT;
ALTER TABLE events ADD COLUMN target_type TEXT;
ALTER TABLE events ADD COLUMN target_id TEXT;
ALTER TABLE events ADD COLUMN target_label TEXT;
ALTER TABLE events ADD COLUMN props_json TEXT;
ALTER TABLE events ADD COLUMN device TEXT;
ALTER TABLE events ADD COLUMN browser TEXT;
ALTER TABLE events ADD COLUMN referrer TEXT;
ALTER TABLE events ADD COLUMN ip_hash TEXT;

UPDATE events SET ts=COALESCE(ts, created_at), event=COALESCE(event, type),
  props_json=COALESCE(props_json, metadata) WHERE ts IS NULL OR event IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_event_ts ON events(event, ts);
CREATE INDEX IF NOT EXISTS idx_events_path_ts ON events(path, ts);
CREATE INDEX IF NOT EXISTS idx_events_target_ts ON events(target_type, target_id, ts);

-- Additive admin metadata; existing ads/submissions are preserved.
ALTER TABLE ads ADD COLUMN starts_at TEXT;
ALTER TABLE ads ADD COLUMN ends_at TEXT;
ALTER TABLE submissions ADD COLUMN admin_note TEXT;
CREATE INDEX IF NOT EXISTS idx_ads_schedule ON ads(status, starts_at, ends_at);
