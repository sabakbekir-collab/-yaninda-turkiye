CREATE TABLE IF NOT EXISTS analytics_session_revocations (
  session_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_revocations_revoked_at ON analytics_session_revocations(revoked_at);
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
