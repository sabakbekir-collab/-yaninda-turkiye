# PR #32 isolated test environment setup

This environment is deliberately separate from the production Worker and both existing D1 databases. Do not add Telegram credentials or cron triggers here.

## 1. Create the dedicated D1 database

```bash
npx wrangler d1 create yaninda-turkiye-pr32-test
```

This creates a new, empty D1 database only. It does not modify the production database or the existing preview database because the name is unique and no existing database is targeted.

## 2. Add the returned database ID

In `wrangler.jsonc`, replace only `YOUR_PR32_TEST_DB_ID` inside `env.pr32-test.d1_databases[0].database_id` with the ID returned by step 1.

This is configuration-only. The production D1 binding and existing preview binding remain unchanged.

## 3. Apply migrations only to the isolated environment

```bash
npx wrangler d1 migrations apply DB --env pr32-test --remote --config ./wrangler.jsonc
```

The explicit `--env pr32-test` selects the environment-specific DB binding named `DB`, which points only to `yaninda-turkiye-pr32-test`. Do not remove `--env pr32-test`.

## 4. Deploy only the isolated Worker

```bash
npx wrangler deploy --env pr32-test --config ./wrangler.jsonc
```

The environment has its own Worker name, `workers_dev: true`, no route/custom-domain declaration, no cron schedule, and no Telegram secrets. This deploy targets only `yaninda-turkiye-pr32-test`; it does not deploy the production Worker.

## 5. iPhone Safari preview address

After step 4 succeeds, open the Worker URL printed by Wrangler. With the configured name it will be:

`https://yaninda-turkiye-pr32-test.<YOUR_CLOUDFLARE_SUBDOMAIN>.workers.dev`

Replace the placeholder with the account's Workers subdomain shown by Wrangler. Verify `/api/health` reports the PR test Worker commit before testing consent, search, page time, ads, analytics, or deletion.

## Safety rules

- Never run D1 migration or deploy commands without `--env pr32-test`.
- Do not add Telegram token, webhook secret, admin chat IDs, production routes, or custom domains to this environment.
- Do not use the old `yaninda-turkiye-preview-db` for this test.
- Do not run data deletion tests against production or a real user's session.
