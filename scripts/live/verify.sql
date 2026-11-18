-- Duty schema verification; run manually after apply-duty.sql in live D1.
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('duty_pharmacies','duty_sync_runs') ORDER BY name;
SELECT name FROM sqlite_master WHERE type='index' AND name='idx_duty_pharmacies_date_area';
