# PR #32 migration numbering — pending read-only audit

Do not rename, edit, or apply any migration until `bash scripts/d1-readonly-audit.sh` has completed and its `d1-audit-report.txt` has been reviewed.

## Decision procedure

1. Read the live applied migration names and Wrangler migration list from the audit report.
2. Let N be the highest numeric migration prefix actually applied in live `d1_migrations`.
3. If the PR analytics migrations are not applied live, plan to rename only the two PR-owned, unapplied files:
   - `0003_analytics_events.sql` → `(N+1)_analytics_events.sql`
   - `0004_analytics_session_revocations.sql` → `(N+2)_analytics_session_revocations.sql`
   Preserve zero-padding (four digits). Never rename or edit any migration already applied in any database.
4. If an applied migration exists in live D1 but its source file is absent from the repository, do not reconstruct it from memory or infer its SQL. Use the audit's `sqlite_master` and `PRAGMA table_info` output to prepare a proposed schema-equivalent file for review only. Do not apply it as a new migration without a separate explicit recovery plan.
5. After a verified rename, update every filename reference in CI, tests, `scripts/local-e2e.sh`, `scripts/go-live.md`, and the PR description. Add a CI test that checks column existence with `PRAGMA table_info` before attempting any `ALTER TABLE ADD COLUMN` migration in local test fixtures.
6. If the audit report is missing, incomplete, or ambiguous, stop migration renumbering and retain the current filenames.

## Current evidence (not a live audit)

- `main` currently contains `0001_init.sql` and `0002_admin_logs.sql` only.
- PR #32 currently contains `0001_init.sql`, `0002_admin_logs.sql`, `0003_analytics_events.sql`, and `0004_analytics_session_revocations.sql`.
- The separate `feat/manual-duty-roster` branch contains `0003_manual_duty_roster.sql`. Its existence explains the old-preview migration name, but does not prove whether it was applied to production.
- Live migration numbering remains unknown until the operator runs the read-only audit.
