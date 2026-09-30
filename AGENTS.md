# Project guide

## Architecture

`src/` contains the React SPA. `App.tsx` owns routes and feature screens, `data.ts` contains the 81-province and category taxonomy, `i18n.ts` contains six UI language packs, and `api.ts` is the thin browser API client. Styling is centralized in `styles.css` with a mobile-first responsive layer.

`netlify/functions/` contains public place lookup, submission, event, and protected admin endpoints. `db/` is the Drizzle schema and client; generated immutable migrations live in `netlify/database/migrations/`. The place endpoint geocodes manual selections, queries Overpass, merges only approved submissions, and degrades to an empty response if an upstream source fails.

`android/` is the generated Capacitor Android project. `store-listing/` contains Play metadata and screenshot slots. Web, PWA, and Android share the same React source.

## Conventions

- Never add fabricated places, phones, duty status, or analytics.
- Keep API keys and credentials server-side and out of version control.
- All persistent structured data belongs in Netlify Database; update `db/schema.ts` and generate a migration for every schema change.
- Preserve the anonymous analytics allowlist and avoid adding precise location or personal data to event metadata.
- Keep service failures isolated and show an explicit empty/error state.
- Admin endpoints require a Netlify Identity user with the server-controlled `admin` role.
- Prefer existing CSS variables and Lucide icons; maintain 44px or larger mobile touch targets.
