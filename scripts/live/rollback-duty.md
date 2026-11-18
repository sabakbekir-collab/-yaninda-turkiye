# Duty schema rollback (manual only)

Only after taking a D1 backup and confirming no duty data needs retention, manually run:

```sql
DROP INDEX IF EXISTS idx_duty_pharmacies_date_area;
DROP TABLE IF EXISTS duty_sync_runs;
DROP TABLE IF EXISTS duty_pharmacies;
```
This deletes imported duty roster records. Never run automatically.