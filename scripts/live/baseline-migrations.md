# Future migration baseline (documentation only — do not apply now)

The live D1 database currently has no `d1_migrations` table and was created/maintained outside Wrangler migrations. Do not run `wrangler d1 migrations apply --remote` against it.

If the team later chooses to adopt Wrangler migration tracking, first take and verify a full export, clone it to an isolated D1 database, compare every table/column/index/trigger, and rehearse the baseline procedure there. Only after explicit approval should a separately reviewed plan be made for production.

A baseline would need to create Wrangler's migration ledger in the exact format expected by the pinned Wrangler version and mark the already-existing 0001–0004 state as applied **without executing those migrations against existing tables**. Do not hand-create `d1_migrations` based on assumptions: its schema and semantics are Wrangler-version-specific. Use Wrangler's documented baseline/adoption procedure if one exists for the pinned version; otherwise do not adopt the ledger.

Risks:
- Incorrect ledger rows can cause old migrations to be replayed or future migrations to be skipped.
- The current live schema was not supplied as a complete `live-schema.sql`; index/trigger equivalence has not been fully proven.
- The live table list lacks `d1_migrations`, and the console query did not reveal migration history.
- This document is informational only. No ledger/table is created by this PR.
