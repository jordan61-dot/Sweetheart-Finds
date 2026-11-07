# Sweetheart Finds — Foundation stabilization (v1.1.0)

An independent merchandise discovery application for Jordan. No Explorer code, repository, data, storage, or deployment is used.

## Run locally for $0

Requires Node 24 (or Node >=22.13 for the app), npm, Python 3 for the optional collector/tests, and a basic computer. No cloud account, API key, paid API, or payment details are required for local development.

```sh
npm ci
npm test
python tests/database.test.py
npm run typecheck
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_easy_red_shift.sql
npm run dev
```

Apply a local migration only once to a given local database. Publishing uses the committed Drizzle migration journal to apply hosted migrations separately. The initial migration includes FTS5 and its maintenance triggers. Later schema changes must append migrations; never edit applied migrations or snapshots. No request handler creates tables.

On ordinary portable local development, the starter provides loopback-only mock sign-in at `/signin-with-chatgpt?return_to=/`. Mock authentication is disabled in managed Linux and production. Managed Linux preview is owned by `sites-preview start <checkout>`; do not start a second preview server.

## Architecture

React 19, TypeScript, Vinext/Vite, Cloudflare Worker, D1/SQLite, Drizzle migrations, Zod validation, Lucide icons. CSS and original SVG illustration implement the visual identity. DM Sans and DM Serif Display load through the free Google Fonts service (system fallbacks apply offline). No paid AI service is used.

Seven application tables: products, product_categories, listings, observations, personal, ingestion, config. An FTS5 index and triggers provide token/prefix search; a bounded substring fallback handles partial terms. Products hold extensible schema-validated metadata and separate normalized seller offers. Asking-price micros are integers; null is unknown, and currencies are never silently converted.

Public Sites hosting and D1 are provided through the existing ChatGPT account. `.openai/hosting.json` contains the independent Site identity and DB binding. Hosting currently has no additional charge for the owner's existing Plus account; the official help page documents a 10 GB database limit per Site and shared limits. No billing account, credit card, overage setting, or paid key has been enabled. Future pricing is not controlled by this application. If included access changes, stop hosted use or use the local deployment; do not accept paid terms as a fallback.

## Security and personal records

Private deployment relies on platform sign-in. Every write also checks authenticated visitor identity, JSON content, and same-origin requests. Personal records are keyed by authenticated user ID; request bodies never select another user. Owner catalog operations require ADMIN_EMAIL in runtime secrets and an exact match to the authenticated email. There is no first-visitor owner claim. Public visitors use device-local personal storage; signing in enables separate account storage. Export/merge a device backup to transfer local records into the signed-in cabinet. Never expose the Worker outside the Sites identity boundary without implementing trusted authentication.

Favorites, wishlists, notes, ownership/purchased status, preferences, and history save to the account, with a browser copy and queued retry operations. Compare-and-swap revisions prevent ordinary concurrent account saves from losing each other's changes. Operation IDs make retries idempotent. A later write to the same note is an explicit field update; this is not a collaborative rich-text merge system.

The browser cache can be evicted, differs between devices/origins, and is readable by other people using the same browser profile. The app does not silently reset unreadable storage. Export personal backups with product references. Exact restore recovers personal records and relationships after confirmation; merge keeps existing lists/favorites and appends conflicting note text. Exact restore also recovers profile/history. Do not clear browser data until queued saves have synced or a backup is saved. Full offline launch/service-worker caching is not implemented; the loaded app can navigate cached views and keep personal edits while the network is unavailable.

## Catalog maintenance

Catalog Studio provides statistics, provenance, JSON/CSV validation and preview, reviewed transactional imports, manual URL entry, metadata editing/reclassification, duplicate merging/redirects, soft archive, custom characters and aliases, failed-import history, source policy information, and JSON catalog export. There is no universal URL scraper. Use data and images you have permission to import. URL entry saves owner-supplied facts as potential matches with unknown/unverified stock.

Import batches: max 250 products / 1.5 MB. All rows validate before writes, and a D1 batch is atomic. Large rich listing batches may exceed runtime/database limits; split them into smaller batches. Duplicate imports preserve original canonical titles/descriptions and merge offers/images. The explicit correction editor can change canonical metadata. Observed offers may be corrected but cannot be silently removed in that editor; observations remain separate. Archiving preserves personal references. Merge redirects identities and preserves source records; export a catalog backup first if an undo might be needed. Automated global popularity, counterfeit authentication, and collector rarity valuation are not implemented.

## Sources and discovery

- `data/catalog.json`: 49 authentic, sourced merchandise identities. 11 currently unavailable Schylling offers; 38 historical/reference identities. No demo merchandise, invented sellers, or active stock claims.
- `data/source-evidence.json`: original factual collection output and provenance.
- `lib/discovery/openlibrary.ts`: modular source-adapter contract and actual Open Library adapter. Human-triggered lookup only, 12 source results per page, 24-hour cache, 1.5-second minimum outbound interval, 12-second timeout, and stale-cache fallback on source failure. Title collisions and irrelevant categories are screened; uncertain editions still need review. No scheduled harvesting of this API.
- `scripts/collectors/schylling.py`: bounded, serial, robots-aware metadata collector for 11 exact source paths, >=3-second delay. It produced 11 records and no errors in the initial run. It writes research-format output; normalize/review before importing. No unattended job is enabled.
- `docs/SOURCES.md`, `docs/EDITORIAL_SOURCES.md`: source permissions, current access limits, price conflicts, image licensing, and Stage 2 opportunities.

Book covers link directly to the Open Library Covers API using source identifiers, as its display guidelines request. Underlying artwork rights stay with the original holders. Thirteen records have cover URLs; individual covers may be missing or fail to load. Other product images are deliberately withheld where reuse permission was not established. One licensed Commons photograph illustrates its own subject in an editorial section; it is not attached to unrelated products or represented as a sale listing. Attribution, source, and CC BY-SA 4.0 license are shown. Brand names are descriptive and do not imply affiliation.

## Stage 2 handoff

Preserve `.openai/hosting.json`, the same production origin, all IDs, migrations, personal storage keys, authored data, and managed source repository. Start from this committed baseline, not a replacement scaffold. Highest priorities: resolve Sanrio UCP agent identity/Web Bot Auth and product/image use terms; obtain approved retailer/resale feeds; add source-wide stock verification and regional shipping; expand exact variant matching and source-authorized photos. Build scheduled collection only after source permission and an actual free execution path are confirmed. The schedule configuration currently records manual mode and rejects enabled unattended collection.

See `docs/STAGE_1_REPORT.md` and `/stage-1-report.html` for the completion report.


## Version 1.1 production procedure

Authoritative repository: https://github.com/jordan61-dot/Sweetheart-Finds, branch main. CI performs clean install, tests, typecheck, and production build on changes. Publication is manual through Sites: select this existing Site, obtain a short-lived source credential, synchronize the reviewed GitHub checkout with the managed publishing repository, build/package it, save that exact pushed revision, then deploy the saved version. Do not put publishing credentials into GitHub or command arguments. Record both GitHub and managed publishing SHAs in the release handoff and run `python tests/production-smoke.py`. Automatic publication is not configured.

Rollback: redeploy the prior saved Site version using Sites version history; keep the same origin and DB binding. Database migrations require forward repairs or a separately reviewed data restore, not blind schema rollback. Version1.1 makes no schema migration or personal-record rewrite. Before migration/export, keep a private complete database export and source bundle; never commit them. The previous Stage1 report is historical, not current verification.

Current remediation evidence and outstanding acceptance blockers: `docs/RELEASE_1_1.md`.
