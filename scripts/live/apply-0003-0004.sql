-- PR #32 live-only additive objects and idempotent data backfill.
-- Run only AFTER all scripts/live/columns/*.sql files have been applied.
-- Column additions are intentionally split into one-statement files because
-- D1/SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS analytics_session_revocations (
  session_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_revocations_revoked_at
  ON analytics_session_revocations(revoked_at);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_event_ts ON events(event, ts);
CREATE INDEX IF NOT EXISTS idx_events_path_ts ON events(path, ts);
CREATE INDEX IF NOT EXISTS idx_events_target_ts ON events(target_type, target_id, ts);
CREATE INDEX IF NOT EXISTS idx_ads_schedule ON ads(status, starts_at, ends_at);
CREATE TRIGGER IF NOT EXISTS events_ignore_revoked_analytics_sessions
BEFORE INSERT ON events
WHEN NEW.session_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM analytics_session_revocations
    WHERE session_id = NEW.session_id
  )
BEGIN
  SELECT RAISE(IGNORE);
END;
UPDATE events
SET ts = COALESCE(ts, created_at),
    event = COALESCE(event, type),
    props_json = COALESCE(props_json, metadata)
WHERE ts IS NULL OR event IS NULL OR props_json IS NULL;
