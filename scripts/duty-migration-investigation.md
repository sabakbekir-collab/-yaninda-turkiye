# Investigation: manual duty roster migration 0003

## Classification

**(b) The file exists on another branch, not on main or PR #32.**

The GitHub branch/tree and path-history inspection found the file at:

- Branch: `feat/manual-duty-roster`
- Migration: `migrations/0003_manual_duty_roster.sql`
- Commit that introduced/completed it: `72740c5e66638f088a488e47bce428a8ec0b1aec`

The file is absent from the current `main` tree and absent from PR #32's head tree. The current `main` migration directory contains only `0001_init.sql` and `0002_admin_logs.sql`. PR #32 contains `0001_init.sql`, `0002_admin_logs.sql`, `0003_analytics_events.sql`, and `0004_analytics_session_revocations.sql`.

Other inspected branches:
- `feat/telegram-admin-bot`: 0001, 0002, 0003_analytics_events, 0004_analytics_session_revocations.
- `chore/live-duty-probe`, `feat/pharmacy-screen-verified-duty`, `fix/turkpidya-duty-parse`: 0001 and 0002.
- `feat/manual-duty-roster`: 0001, 0002, 0003_manual_duty_roster.

## Route and schema findings

There is no `functions/api/duty-check.ts` file in the inspected main tree. Main's `worker/index.ts` implements `/api/duty-check` inline as an admin-only diagnostic GET route that calls the external eczaneadresi provider; that route itself does not query the manual roster tables.

The separate `feat/manual-duty-roster` branch contains the manual roster implementation:
- `functions/lib/manualDutyPlaces.ts` reads the current manual duty rows.
- `functions/lib/telegramD1Store.ts` reads and writes the roster and Telegram-link state.
- `functions/lib/schema.ts` also creates these tables at runtime in that branch.

The 0003 migration creates the following tables and columns:

| Table | Columns |
|---|---|
| `manual_duty_rosters` | id, province, province_slug, duty_date, source_label, created_at |
| `manual_duty_entries` | id, roster_id, district_slug, name, address, phone |
| `telegram_settings` | key, value |
| `telegram_link_codes` | code, expires_at, used |
| `telegram_link_attempts` | chat_id, window_started_at, attempts, locked_until |
| `telegram_pending_rosters` | chat_id, payload, expires_at |
| `roster_events` | id, type, province, duty_date, created_at |

It also creates indexes on manual-duty entries, Telegram link attempts, and roster events.

## Production status: not established

The old preview D1 showing `0003_manual_duty_roster.sql` is consistent with that separate feature branch. It does **not** prove that the live D1 has this migration. Main's current runtime schema does not create these tables. The live database may still have received the schema through an earlier branch/deployment or manual operation; only the read-only live audit can establish that.

Do not recreate this migration from assumptions, rename it, or apply anything based only on this repository inspection. Compare live `d1_migrations`, `sqlite_master`, and `PRAGMA table_info` output first.
