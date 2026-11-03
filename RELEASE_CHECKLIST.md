# Release checklist

- Upload this archive to the repository root as `yaninda-turkiye-fixed.zip`.
- Run `Expand Yaninda Turkiye project` from GitHub Actions.
- The ZIP-only upload is ignored by CI and Cloudflare deploy; the expansion commit triggers both workflows.
- CI runs `npm ci`, `npm run lint`, and `npm run build`.
- Cloudflare deploy independently runs `npm ci`, `npm run lint`, and `npm run build` before Wrangler deploy. A lint/build failure blocks deploy.
- Required Cloudflare repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Keep Worker variables/secrets `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` configured in Cloudflare.
