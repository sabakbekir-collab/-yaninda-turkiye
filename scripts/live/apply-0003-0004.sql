-- Live-schema additive objects absent from scripts/live/fixtures/live-schema.sql.
-- Column ALTERs are intentionally kept in scripts/live/columns/*.sql (one-shot).
-- Every object below is absent from the captured live schema and is idempotent.
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
