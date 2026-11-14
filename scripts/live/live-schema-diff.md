# Live schema comparison (fixture is source of truth)

Source: `scripts/live/fixtures/live-schema.sql`, reconstructed exactly from the operator-provided schema-only `sqlite_master` output. No row data is present. Fixture line numbers below are 1-based.

## Base migrations

| Object | Result | Evidence |
|---|---|---|
| 0001 tables: events, submissions, reports, ads, api_cache | PASS | Definitions match fixture lines 6–10 respectively (events line 8; submissions line 10; reports line 9; ads line 6; api_cache line 7). |
| 0001 indexes: idx_events_type_created, idx_submissions_status, idx_reports_status, idx_ads_placement_status, idx_api_cache_expires | PASS | Fixture lines 11–15. |
| 0002 admin_logs table | PASS | Fixture line 5. |
| 0002 idx_admin_logs_created | PASS | Fixture line 11. |
| 0001/0002 table/column/index shape | PASS | All migration-defined base objects and columns match the supplied CREATE statements; no missing or differing base column/index was observed. |
| Additional platform objects | INFO | `_cf_KV` and `sqlite_sequence` are present in the observed snapshot (fixture line 4 and SQLite AUTOINCREMENT metadata). |

## 0003 expected differences

| Object | Result | Evidence |
|---|---|---|
| events.ts, session_id, user_id, event, path, target_type, target_id, target_label, props_json, device, browser, referrer, ip_hash | FARK – all 13 absent | Fixture line 8 defines events with only id, type, metadata, city, created_at. |
| ads.starts_at, ads.ends_at | FARK – both absent | Fixture line 6 has no starts_at or ends_at. |
| submissions.admin_note | FARK – absent | Fixture line 10 has no admin_note. |
| idx_events_ts, idx_events_session_ts, idx_events_event_ts, idx_events_path_ts, idx_events_target_ts | FARK – all absent | Fixture line 14 contains only idx_events_type_created for events. |
| idx_ads_schedule | FARK – absent | Fixture line 12 contains only idx_ads_placement_status for ads. |

## 0004 expected differences

| Object | Result | Evidence |
|---|---|---|
| analytics_session_revocations table | FARK – absent | No CREATE TABLE for it in fixture (all table statements are lines 4–10). |
| idx_analytics_revocations_revoked_at | FARK – absent | No matching CREATE INDEX in fixture (lines 11–16). |
| events_ignore_revoked_analytics_sessions trigger | FARK – absent | Fixture contains no CREATE TRIGGER statement. |

## ALTER safety

All 16 proposed additions use nullable `TEXT` with no NOT NULL constraint and no required default. They are valid additive SQLite/D1 ALTER operations for existing populated tables. No column is already present in the fixture, so none of the 16 files should be deleted.

## Legacy/new analytics field behavior

`functions/api/events.ts` continues to insert into legacy `events(type,metadata,city)`; `created_at` is supplied by its existing DEFAULT. `functions/api/track.ts` inserts legacy columns and new columns together. `type` and `event` intentionally carry the same event name; `created_at` and `ts` intentionally carry the same timestamp; `metadata` and `props_json` intentionally carry the same serialized properties. These are parallel compatibility fields, not duplicate column definitions. The old event endpoint remains compatible with the additive schema.

## Rollout safety

This is a schema comparison of the supplied snapshot, not proof of live migration history. The snapshot has no `d1_migrations` table and no trigger/revocation table. Do not run migrations 0001/0002 on live; they already match. Apply only the 16 missing-column files followed by `apply-0003-0004.sql`, after a separate reviewed backup/approval. No live operation is part of CI.
