# PR #32 live D1 rollback plan

**Do not run this automatically.** This is an operator procedure for an approved maintenance window. The additive column changes cannot be safely removed from SQLite/D1 without rebuilding tables; the preferred rollback is restoring a verified backup to a separate database and switching the Worker binding only through an explicitly approved release.

## Before apply
1. Export the live database using the exact command in `scripts/go-live.md`.
2. Verify the export is non-empty, copy it outside the repository, and protect access.
3. Record table/index/trigger names and counts. Do not include user rows in this repository.
4. Apply each column file only after checking that its column is absent. Stop on any unexpected state.

## Roll back the new trigger and table
Only if the new feature must be disabled and the operator has confirmed no other code depends on them:

```sql
DROP TRIGGER IF EXISTS events_ignore_revoked_analytics_sessions;
DROP TABLE IF EXISTS analytics_session_revocations;
```

These statements remove revocation protection/state. Do not execute them casually.

## Columns and indexes
- SQLite/D1 does not provide a safe general `DROP COLUMN` rollback for all deployed compatibility levels. Do not attempt a table rebuild on live as an improvised rollback.
- Leave added nullable columns and indexes in place while reverting the Worker to its previous version; they are additive and backward-compatible.
- If exact pre-change restoration is required, restore the verified export to a **separate** D1 database first, verify schema and data there, then plan a controlled binding switch. Never import over the production database without an explicit recovery approval.

## Verification after rollback
Run read-only schema inspection and application health checks against the selected database. Confirm the old Worker version is bound to the intended database. Record every operator action.
