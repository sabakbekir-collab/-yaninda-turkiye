-- Read-only post-apply verification. Every expected object should return 1.
SELECT 'analytics_session_revocations table' AS check_name,
       EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='analytics_session_revocations') AS ok;
SELECT 'events revocation trigger' AS check_name,
       EXISTS(SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='events_ignore_revoked_analytics_sessions') AS ok;
SELECT 'events.ts' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='ts') AS ok;
SELECT 'events.session_id' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='session_id') AS ok;
SELECT 'events.user_id' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='user_id') AS ok;
SELECT 'events.event' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='event') AS ok;
SELECT 'events.path' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='path') AS ok;
SELECT 'events.target_type' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='target_type') AS ok;
SELECT 'events.target_id' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='target_id') AS ok;
SELECT 'events.target_label' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='target_label') AS ok;
SELECT 'events.props_json' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='props_json') AS ok;
SELECT 'events.device' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='device') AS ok;
SELECT 'events.browser' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='browser') AS ok;
SELECT 'events.referrer' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='referrer') AS ok;
SELECT 'events.ip_hash' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('events') WHERE name='ip_hash') AS ok;
SELECT 'ads.starts_at' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('ads') WHERE name='starts_at') AS ok;
SELECT 'ads.ends_at' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('ads') WHERE name='ends_at') AS ok;
SELECT 'submissions.admin_note' AS check_name, EXISTS(SELECT 1 FROM pragma_table_info('submissions') WHERE name='admin_note') AS ok;
SELECT 'events ts index' AS check_name, EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_events_ts') AS ok;
SELECT 'events session index' AS check_name, EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_events_session_ts') AS ok;
SELECT 'ads schedule index' AS check_name, EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_ads_schedule') AS ok;
