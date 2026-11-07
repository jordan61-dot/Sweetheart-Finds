# Sweetheart Finds 1.1 engineering report

November 7, 2026. Stage 2 has not started. Preserve the original production origin and D1 binding.

## A. Source preservation and GitHub

Authoritative source: https://github.com/jordan61-dot/Sweetheart-Finds, branch `main`. The repository's original `e7198bc7f715890266c1ffd5c2df69f21171cf68` commit was retained as parent of the complete source synchronization `b41b552badd86ef47e84644407cb6cf9e5452244`. Subsequent remediation commits retain that history. The final SHA is recorded in the release delivery.

The synchronized tree includes frontend/backend, routing, styling, schema/migrations, real public source records, tests, lockfile, setup/build scripts, licensed editorial image, license notices, README, and CI. 148 files were synchronized initially. No runtime data, notes, browser caches, private database backups, credentials, or dependency directories were published. A high-confidence secret-pattern scan passed. The pre-change source is recoverable from saved Site history and a private Git bundle; a complete untruncated application-table database export was retained privately before deployment changes. FTS is derived from product records and schema triggers.

A fresh GitHub clone installed dependencies, passed 21 JavaScript tests and5 SQLite tests, type checks, and production build. The final dependency upgrades are separately validated by the same checks. No installed global GitHub credentials were available; the authenticated GitHub connector synchronized source without exposing tokens.

## B. Public access and deployment

Production: https://sweetheart-finds.jordanmullens12.chatgpt.site

Diagnosis: the host policy had already been changed to public (revision2) before this remediation. A normal anonymous browser displayed the homepage without ChatGPT sign-in. Independent curl requests returned200 for homepage and catalog. Python urllib received a host403/1010 response; that specific client restriction is recorded rather than treated as an application failure or bypassed. The HTTP smoke test uses the working independent curl client.

Twenty-three HTTP scenarios passed against the pre-release production baseline: seven homepage/nested/API/private-boundary checks, all14 category queries with relevant product membership, combined Books/alphabetical filtering, and typo correction. `/api/personal` and `/api/admin` correctly returned401 anonymously. Final publication and post-release smoke results are recorded in the delivery.

Public browsing remains anonymous. Personal account data requires sign-in; anonymous personal records stay browser-local and are accurately labeled. ADMIN_EMAIL is configured as a runtime secret from the verified Site-owner identity, never committed to GitHub. An authenticated email must match that value to access catalog administration. No first-visitor claim or request-supplied owner ID is accepted.

CI on public GitHub standard Linux runners performs install, JavaScript and SQLite tests, typecheck and build, with read-only repository permissions,15-minute timeout, concurrency cancellation, and no artifact upload. Automatic production publication is not configured. The documented manual procedure builds the reviewed GitHub source through the retained Sites publishing repository, saves the exact managed commit and archive, deploys the saved version, then runs smoke checks. Rollback redeploys the prior saved Site version while keeping origin/DB binding; database migrations must be forward-repaired or restored separately. Version1.1 performs no schema migration or personal-data rewrite.

## C. Defect register

| Defect | Severity | Root cause | Correction / verification |
| --- | --- | --- | --- |
| GitHub contained only README | P0 | Stage1 source existed only in managed publishing repository | Complete source synchronized; original GitHub parent retained; fresh clone install/test/build passed |
| Prior private access assessment stale | P0 diagnosis | Host policy changed after initial delivery | Current public policy inspected; anonymous browser and curl200 verified; no new origin introduced |
| First authenticated visitor could become admin | P0 | INSERT OR IGNORE owner claim in a now-public deployment | Removed claim; explicit secret-configured owner email check; missing configuration denies access |
| Dependency security advisories | P0/P1 | Old framework/toolchain and validation packages | Compatible Next/React RSC/Vinext/Vite/Cloudflare toolchain updates; Zod4 migration removes private schema internals; tests/type/build passed; final audit0 critical,0 high,16 moderate development-tool findings |
| Future timestamp could count as fresh stock | P1 | Freshness checked only maximum age | Nonnegative observation age required; regression test passed |
| Collector pet-number/series fields absent from search | P1 | Search text omitted collector fields | Selected collector identifiers included in search indexing for new/updated records; regression passed. Existing populated collector identifiers require reindex during a future controlled data update |
| Merged favorites could render duplicate canonical cards | P1 | Saved IDs resolved after iteration without deduplication | Resolve and deduplicate IDs before rendering |
| Invalid catch-all routes returned generic200 | P1 | Catch-all accepted arbitrary paths | Restrict to supported application paths; unknown paths use framework404 |
| Anonymous visitor had no direct account sign-in link | P1 | Header assumed private deployment | Added normal top-level ChatGPT sign-in link; browser-only storage remains usable |
| Anonymous mobile header could crowd | P1 | Additional sign-in control widened actions | Hide redundant theme icon when the mobile sign-in link is present; retain visual identity |
| Missing reproducible CI and public maintenance instructions | P1 | Managed-only workflow | Added CI, environment example, deployment/rollback instructions and public/private data boundaries |
| Remaining moderate dev-tool advisories | P1 open | Transitive lint/compiler dependencies |16 remain; no high/critical findings. Review upstream fixes before untrusted development tooling inputs |

## D. Functional and persistence verification

The21 JavaScript tests cover real baseline validation, all14 taxonomy memberships, source normalization, book relevance/collisions, aliases/Japanese search terms, price/null handling, stable IDs, safe URLs/imports, CSV quoting, idempotent favorites, wishlist operations, exact backup restoration, merge preservation, preference scoring, malicious reserved keys, future stock timestamps, and collector search fields. The5 isolated SQLite tests cover migration/FTS triggers, FK rollback, revision conflicts, currencies/null prices, and SQL-injection values staying data.

Source review confirmed public catalog reads and account-scoped personal APIs, CAS personal updates, owner-only administrative paths, bounded JSON requests, and parameterized SQL. No real personal records were mutated. Production database snapshot contained zero account-personal rows. Browser-local records cannot be enumerated across the owner's devices; their preservation relies on unchanged origin/storage keys and the existing export/merge/exact-restore controls. A new deployment does not intentionally clear browser storage.

The complete original24-test suite was recovered, rerun, and expanded to26 tests. Earlier Stage1 browser checks remain historical evidence; this remediation does not claim a fresh exhaustive control-by-control audit, authenticated owner administration, cross-device synchronization, browser-restart testing, or physical Galaxy/iPhone/mobile-network testing. These remain explicit validation limits. Do not confuse ordinary private-browser storage loss with a successful account sync.

## E. Live database reconciliation

| Metric | Actual snapshot |
| --- | ---: |
| Canonical products |49|
| Historical/reference identities |38|
| Seller offers |11|
| Unavailable offers |11|
| Verified active offers |0|
| Distinct listing URLs |11|
| Offers missing price |1|
| Records with image URLs |13|
| Source labels |8|
| Records missing source name/URL |0|
| Unknown licensing classification |25|
| Account-personal rows |0|
| Product-category associations |83|

Counts overlap across parent categories/collaborations. Category totals: LPS11; MLP3; Shopkins2; Num Noms3; Crumbs1; Lalaloopsy3; Monster High2; Sanrio21; Pompompurin3; Hello Kitty2; My Melody12; Usahana4; Mezzo Piano12; Justice4. No new active offer was invented. Zero active offers follows actual source coverage and unavailable retailer observations, not a database sync failure.13 image URLs do not guarantee successful image loading. Invalid/dead third-party source links and image availability have not all been reverified; neither a fabricated zero-error count nor universal image coverage is claimed.

## F. Security, privacy and recovery

Public catalog/source records are intentionally public; preferences, wishlists, notes, ownership and account history are neither bundled nor exported to GitHub. Signed-in users cannot select another user's ID through request bodies. Administrator authorization now depends on verified platform identity and a runtime secret. The database owner-claim row is no longer an authorization source. Direct Workers outside the trusted Sites dispatch boundary require a separate authentication design.

Public input is displayed as text in React; arbitrary product URL requests are not proxied server-side. Existing import validation, body-size limits, transaction batches, soft archives, immutable observations and account backup formats remain. Owner edit/merge concurrency and comprehensive malformed-import integration testing remain expansion risks and require an isolated authenticated test environment. No private backup is in the public repository.

## G. Testing, performance and limits

Local automated checks:21 JavaScript tests plus5 SQLite tests pass; TypeScript and production builds pass. A clean clone of the complete synchronized repository reproduces the original toolchain and tests. Upgraded toolchain also builds successfully. The initial independent curl homepage measurement was5.551 seconds including network/host overhead; this is not a lab LCP measurement or proof of an improvement. Updated build emits a163 KB application chunk (about45 KB gzip), with separate framework chunks. Catalog results remain server-paginated at24 rows and use FTS5 plus indexed associations; this release does not transfer the complete database to each visitor.

No formal axe/WCAG certification, load test at thousands of products, memory/battery benchmark, full accessibility regression, authenticated end-to-end suite or continuous production uptime monitor was performed. These checks are blocked/unperformed, not counted as passed. Existing pastel design, keyboard labels/focus, reduced-motion rules, backups and mobile navigation remain.

## H. Cost inventory

| Service | Use / limits / cost control |
| --- | --- |
| Existing ChatGPT Sites | Public Worker and D1; current included account hosting;10 GB database maximum plus shared allowances; no additional plan/key/card purchased |
| GitHub public repository | Source, standard Linux CI; standard public runner usage is free; no larger runners, artifact uploads or paid services configured |
| npm/open-source packages | Locked source dependencies; no paid runtime API |
| Open Library | Human-triggered lookup,12 source results/page,24-hour cache,1.5-second interval,12-second timeout; no scheduled harvesting |
| Schylling collector | Standard-library Python, bounded permitted paths, robots delay; no paid scraping service |
| Images/fonts | Source-authorized cover display, licensed Commons editorial image, free fonts with fallbacks; no paid image API/CDN account |
| Scheduler/logging/backups | No scheduled job enabled; bounded in-app activity; private manual exports; no paid logging/backup service |

Current official references: https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites and https://docs.github.com/en/actions/concepts/billing-and-usage . Sites documentation also announces metering/overages from January2027 above included allowances. No exposed tool in this session configures a hard account spending cap; therefore perpetual hosted $0 with guaranteed no-overage behavior is not verified. Keep local execution available and do not enable paid overages. This is a financial acceptance limitation, not a promise that future hosted traffic is unconditionally free.

## I. Stage 2 readiness and J. classification

INCOMPLETE — CRITICAL ISSUES REMAIN for unconditional Stage2 approval: guaranteed hosted no-overage controls have not been established, and the complete requested authenticated production/administration and recovery audit remains unverified without an owner session. The existing app is preserved, public browsing is functional, GitHub source is complete, and substantial security remediation has been implemented. Stage2 must not begin on the strength of unperformed tests.

Further focused work: verify authenticated owner/non-owner boundaries and real ingestion/import against an isolated database; finish mobile/accessibility controls audit; validate large-catalog query behavior; evaluate remaining moderate tool advisories; establish enforceable free-hosting fail-closed controls or an independently verified free deployment fallback. Do not start mass discovery or fabricate active offers to clear a checklist.
