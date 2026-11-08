# Sweetheart Finds 2.3 — implementation and verification ledger

Classification: **INCOMPLETE**. The recurring merchandise and automatic photography production acceptance criteria remain open. Fixture success must not be represented as live discovery.

## Baseline and preservation

GitHub baseline verified 2026-11-08: `390d4aab7c280255a84e12f125b14bcae568413b`. Deployed version 8 source: `bb92c89db34266b58ee811586c9ec1279df76f2d`. This includes the manual update button missing from GitHub main. Both baselines are retained.

The private pre-change database backup contains 74 products, 34 listings, 56 observations, 118 category associations, one personal record, 12 configuration records, four ingestion records, two discovery jobs, six source-health records and zero match reviews. It was saved privately; no database backup or personal data is included in GitHub.

At the production baseline check, 11 offers met the existing source freshness window and 14 products carried image URLs (18.92%). These are **image-source coverage**, not 14 independently verified exact collectible photographs. Existing source-specific expiration continues dynamically.

No destructive migrations or identifier rewrites. New feed state, checkpoints, bounded execution histories and media candidates use the existing `config` table and therefore participate in the existing transactional backup/restore format. Dedicated indexed media tables are deferred; this implementation is for a small permissioned catalog, not unlimited scale.

## Implemented

- Recurring JSON and CSV merchant exports with field mapping, source-specific intervals, permission evidence/expiry, separate image permissions and server-controlled outbound hostname allowlists.
- Conditional ETag/Last-Modified retrieval, 1.5 MB response bound, 250-record feed bound, ten-record transactional checkpoints and stable source-product/variant offer identities. CSV images are not decoded automatically; use JSON for galleries.
- Atomic leases with late-result fencing, catalog revision protection, source suspension checks, bounded retries and explicit recovery. Eight source fetches per UTC day. HTTP Retry-After is honored within a one-day ceiling. A failed/empty/partial source response never marks missing offers sold.
- Source offer refresh and price observations flow through the existing catalog writer and FTS triggers. Existing owner metadata and personal references remain intact. No name-only cross-source merge.
- GitHub OIDC-authenticated bounded collector endpoint and quarter-hour scheduled workflow. No long-lived scheduler secret is required. Actual execution evidence is recorded below.
- Exact source-product/variant image matching, identifier and generation conflict rejection, permission checks, image MIME/availability verification and automatic publication for qualifying feed photographs. Expired new image permissions hide those images in browsing and detail galleries.
- Resumable existing-product Commons candidate discovery, explicit per-file license metadata, source attribution, human exact-product confirmation/rejection and guarded publication. Candidate discovery alone does not prove a suitable photograph exists. No automatic publication based on franchise names or title similarity.
- Catalog Studio feed controls, execution histories, overdue indicators, photo decisions and resumable backfill controls.
- Manual reference-update button no longer tries to execute an already reviewed/running job. Existing reviewed results remain in the job panel.

## Sources and actual automation

| Route | Current authorization / output | Scheduler |
| --- | --- | --- |
| Participating merchant JSON/CSV | No approved URL or source permission supplied; zero registered production feeds | Scheduler operational after repair; no approved merchant source |
| Bonanza | Official developer application explicitly requires approval before marketplace access; no authentic developer ID supplied | Disabled |
| Etsy | Official Personal App review is required for this buyer-facing use case; seller-only access is not a substitute | Disabled |
| Rakuten Ichiba | Current 2026-07-01 documentation requires applicationId plus accessKey; neither supplied | Disabled |
| eBay | Production eligibility and applicable Buy API agreements must be established for the application; no production credentials supplied | Disabled |
| Shopify UCP merchants | Prior five signed HTTP 401 observations retained; no new handshake loop | Disabled |
| Open Library | Existing human-triggered reference lookup, no sale stock | Manual only |
| Wikimedia Commons | Public licensed-media search; per-file license and identity review required | Scheduled and owner-triggered resumable backfill |
| RSS/Atom/XML and affiliate exports | No approved relevant export established in this release; parsing adapters not implemented | Disabled |

New merchandise imported automatically in production: **0 as of preparation**. Updated merchandise listings through the new scheduler: **0**. A failed scheduled run was successfully retried against production on November 8; see the recovery evidence below. No approved source was fabricated to satisfy acceptance.

Official evidence checked 2026-11-08:

- https://api.bonanza.com/accounts/new and https://api.bonanza.com/docs/reference
- https://developer.ebay.com/api-docs/buy/buy-requirements.html
- https://developers.etsy.com/
- https://webservice.rakuten.co.jp/index.php/documentation/ichiba-item-search
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical/en
- https://docs.github.com/en/actions/concepts/billing-and-usage

## Owner actions that unlock live collection

The shortest direct route is one cooperating retailer granting recurring retrieval, durable catalog retention and product-image display for a JSON export. Alternatively obtain approved marketplace access; an account or publicly readable storefront alone does not establish those permissions. Scheduler activation no longer requires an owner-managed GitHub secret. Retailer/API access remains a separate dependency.

Application description: “Sweetheart Finds is an independent personal collectibles discovery site. It helps a small audience find character merchandise and links directly to original seller listings. It does not process purchases, resell data, impersonate the marketplace or infer stock from failed requests. We request authorized item search/lookup, prices, variant identifiers and listing-context image display, with source-approved refresh and retention limits.”

Do not paste developer credentials into the public repository, feed JSON or a chat report. Configure secrets server-side. See `PERMISSIONED_FEEDS.md` for the runnable feed contract and activation steps.

## Testing and limits

Initial completed checks: 63 JavaScript tests, ten SQLite database tests and TypeScript checking. The feed integration tests exercise the real catalog writer, FTS, observations and transaction guards against isolated SQLite with fixture HTTP responses. They prove implementation behavior, not access to a retailer.

Tests cover stable identities, incompatible variants, image rights, unsafe URL rejection, conditional requests, idempotent imports, checkpoint continuation, failure preservation, active-run exclusion, revision conflicts and collector authentication. Existing personal-data and backup regression tests remain passing.

Not yet proven: unattended production collection, approved retailer API integration, multiple real scheduled runs, exact-product photo backfill success, large-scale load/concurrency, comprehensive mobile/accessibility regression and every requested media administration feature. XML/RSS/Atom parsing, dedicated media tables, media embeddings, broader marketplace adapters remain outstanding.

## Cost controls

No new paid service, billing account, proxy, image processing API or storage binding. Images use authorized remote URLs; no caching/derivatives are created. Existing ChatGPT Sites hosting/account remains a dependency. Its account-specific hosting quotas are not exposed here, so unlimited free capacity is not claimed.

GitHub documents standard hosted runners as free for public repositories. This workflow uses ubuntu-latest, one concurrent job, a three-minute job ceiling and a 120-second HTTP ceiling. Do not move it to a private repository or paid runner without checking account quotas. Scheduled GitHub workflows can be delayed and public-repository schedules can be disabled after inactivity; owner monitoring and periodic repository maintenance remain necessary. No perpetual-scheduler promise is made.

At most two due feed pages run per tick, ten records/page, one image HEAD check per record and thirty history entries/feed. Photos must pass separately configured image-host approval. Resource consumption must be measured before adding many merchants; the current zero-feed deployment has no merchandise collection traffic.

## Stage 2 outlook

Stage 2 remains incomplete. The application can now execute a permissioned feed-to-catalog pipeline, but genuine live merchandise and scheduled-execution evidence require approved source access. Stage 3 has not begun.


## Continuation — November 8, 2026

Production version 9 was deployed from `f537b40397c36a20653ff17c74f9dd64bfca922c`; GitHub implementation commit is `bb7816459031f352f367ab7b7b4d79da9d5519cf`. GitHub Verify foundation run 42448184093 succeeded. The independent production smoke suite passed its routes, authorization boundaries, all fourteen category queries, book sorting and typo correction. The new owner endpoint rejected anonymous requests (401), and the then-unconfigured service endpoint returned 503.

The production Commons backfill completed all **74 products**, finding **five candidates**. None was auto-published; exact identity is unresolved. Product/offer counts remain **74/34**, with **14 image-source records (18.92%)**. As of the morning check, all prior stock observations had expired: **zero source-current offers**. This is expiration, not a claim that all offers sold.

The shared-secret activation dependency has now been replaced in source by GitHub OIDC authentication. It pins the numeric repository ID 1449222249, owner ID 348051783, exact main-branch workflow, expected audience, issuer, public repository, hosted runner and permitted event types. JWT signature and time checks plus persistent one-use token claims prevent anonymous calls and replay. Forks and pull requests cannot invoke the writer. No long-lived scheduler secret or new account is required.

The workflow now ticks every fifteen minutes; each source still retains its own due time and budget. It performs bounded eligible-feed work, resumable photo discovery and one existing-product image availability audit, retaining execution event/run IDs and history. A successful media audit verifies URL/MIME availability, not exact collectible identity. Real scheduled execution evidence must still be appended after it is observed; source code alone is insufficient.

The repository remains public. No paid infrastructure was introduced. GitHub standard runners are covered by its public-repository free usage, while the existing Sites subscription remains a hosting dependency. Updated unit suite: 68 passing tests, including actual RSA signature verification and rejection of forged, expired, wrong-repository and wrong-workflow credentials.

## Runtime repair and recovery — November 8, 2026, 18:04 UTC

The latest failed collector run was [42507556877](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/42507556877). Its first attempt failed at 17:57:59 UTC: Cloudflare Workers rejects Fetch `redirect: "error"`. The option occurred in JWKS authentication, feed retrieval and image validation, so fixture tests alone missed a real runtime incompatibility.

Site **version 11** deployed successfully at **18:04:44 UTC**, managed source `6bc498e0d52a64c71e0e2d1d7aaf8a08633e92db`. GitHub repair commit: `92976003da64e05cd515acdfca5b081202d94c55`. Requests now use manual redirect inspection; feed redirects remain rejected. The regression test verifies that a redirect does not cause a second feed request. GitHub Verify foundation run **42508146158 passed**.

The failed scheduled run was explicitly retried after deployment. Attempt **2 passed**, authenticated with an actual GitHub-issued identity, and wrote a production runtime record from **18:04:58.407 to 18:04:58.961 UTC**. It reported zero eligible feeds, completed existing backfill, and audited one existing product (`openlibrary-OL16262987W`). That image returned HTTP 302, accurately recorded as verification-failed. No merchandise or exact photograph was manufactured to make the run pass. This is a manually initiated recovery of a scheduled-event run, **not yet evidence of a fresh unattended post-repair cron trigger**.

Earlier scheduled attempts at 13:37, 14:27, 15:14, 15:56, 16:42 and 17:20 UTC failed before the repair. The observed launch spacing was substantially longer than the configured fifteen minutes. GitHub scheduling delays are a practical limitation: the dashboard's expected-run warning must not be interpreted as a guarantee of exact timing.

Additional maintenance fixes:

- Persistent per-product photo-search checkpoints replace dependence on alphabetical order, so a newly added product with an earlier ID is still processed. The completed baseline cursor is upgraded without searching all existing records again. Products with offers receive priority.
- Gallery audits check up to three images per tick and resume until all images are checked. Changed galleries are detected. Every result retains permission and identity caveats.
- Image audits may follow at most two redirects within the same approved HTTPS origin; cross-origin redirects remain blocked. Feed and authentication redirect policy is unchanged.
- Audit failures are visible warnings rather than silent success assertions. Availability checks never establish exact-product identity.
- Concurrent photo rejection fences off an in-flight approval transaction; stale decisions cannot overwrite the owner’s newer decision.

Validation: **74 JavaScript tests passed**, including SQLite-backed maintenance history, duplicate-tick exclusion, cursor upgrade, full-gallery continuation, bounded same-origin redirects and concurrent photo-review rollback. **Ten database tests**, TypeScript and the production build pass. Independent production checks passed all nine tested routes, all fourteen category queries, alphabetical book sorting and spelling correction. Protected routes returned 401 anonymously. These fixture tests still do not prove retailer authorization or live merchandise collection.

### Product and image accounting

| Interest | Products | Products with existing image URLs |
| --- | ---: | ---: |
| Littlest Pet Shop | 13 | 3 |
| My Little Pony | 5 | 0 |
| Shopkins | 5 | 2 |
| Num Noms | 5 | 3 |
| Crumbs Sugar Cookie | 3 | 0 |
| Lalaloopsy | 5 | 2 |
| Monster High | 6 | 3 |
| Sanrio | 29 | 1 |
| Pompompurin | 5 | 0 |
| Hello Kitty | 4 | 1 |
| My Melody | 14 | 0 |
| Usahana | 6 | 0 |
| Mezzo Piano | 13 | 0 |
| Justice Girls | 5 | 0 |

Categories overlap. Unique products remain **74**, listings **34**, observations **56** and personal records **1** at the last authenticated reconciliation. Existing image URL coverage is **14/74 (18.92%)**; exact suitable-image coverage has not been independently established. Commons backfill processed **74**, generated **5 review candidates**, and automatically assigned **0**. No new authorized merchandise source was activated. Source-current offers were **0** after the prior observations expired; this is not evidence of sellout. Complete broken/expired-image totals await the bounded audit pass.

### Remaining completion blockers

No retailer has supplied a recurring feed with durable-indexing and photo-display authorization, and no approved marketplace credentials are available. Public storefront accessibility is insufficient evidence. The prepared feed contract and application description allow owner-authorized activation without another architecture rewrite. External actions are limited to obtaining one approved merchant feed or approved marketplace access, then setting the relevant secure source configuration. Existing Commons candidates need exact-product review; five candidates are not five usable photos.

Dedicated media tables, RSS/Atom/XML adapters, broader marketplace adapters, source-specific retention cleanup, comprehensive media administration, high-volume concurrency/load proof and full mobile/personal-storage regression remain unfinished engineering scope. No claim of full Stage 2.3 completion is justified. No paid service or billing was enabled. Stage 3 has not begun.

## Continuation — November 8, 2026, 16:20 Eastern

### Independent scheduled execution confirmed

Four fresh scheduled runs completed successfully on their **first attempts**, without manual dispatch or retry:

| GitHub run | Trigger time (UTC) | Eastern time | Result |
| --- | --- | --- | --- |
| 42511642855 | 18:46:16 | 13:46:16 | Passed |
| 42515158288 | 19:27:47 | 14:27:47 | Passed |
| 42519125796 | 20:14:41 | 15:14:41 | Passed |
| 42522748986 | 20:57:52 | 15:57:52 | Passed |

Direct logs from the first and last runs confirm signed GitHub authentication, production database history writes, completed backfill state and real image requests. The first image check returned JPEG/200; the last retained a 302 verification warning. All reported zero eligible merchant feeds. Thus recurring **maintenance** is proven; recurring **merchandise ingestion** remains unproven. Observed scheduler spacing remains roughly 40–47 minutes, despite a fifteen-minute cron expression.

### Working shopper-triggered merchandise route

Wildmart publishes a documented, unauthenticated product-discovery REST API. Its live endpoints returned actual Hello Kitty and Monster High products, product IDs, canonical retailer links, MDL prices and source stock fields on November 8. Its documentation requests links back to the canonical storefront and cache-header compliance. Its delivery page documents Moldova delivery; US delivery is not established.

The new site search calls this service only after a signed-in shopper submits a query. It offers all fourteen interest presets, custom keywords and user-triggered cursor pagination. A bounded response normalizer excludes unrelated or unsafe records, preserves MDL, suppresses stale/unknown prices and stock, and displays the source's projection timestamp. It does not translate or embellish the retailer's product titles.

Results expire after sixty seconds and are held only in component memory. The endpoint sends `Cache-Control: no-store`. They never enter products, listings, observations, FTS, favorites, local/session storage or database backups. Only global rate/cost counters and source cooldowns are persistent. The cap is 200 requests/day, one request per three seconds, with a ten-second timeout and 512 KiB body limit; redirects are rejected. Retailer 429/503 responses enforce cooldowns. No storefront scraping, account creation, credentials or payment is used.

Durable catalog indexing and image reuse were **not** established. Therefore this source is not enrolled in unattended harvesting, and its images/descriptions are not copied. Product cards link to the merchant page to inspect photographs and exact variants. This is an operational alternative within the requested temporary shopper-discovery mode, not evidence that the primary autonomous collection acceptance criterion is complete.

Primary sources:
- https://wildmart.md/public-api/docs/
- https://wildmart.md/public-api/openapi.json
- https://wildmart.md/ro/achitare-si-livrare

Other newly assessed routes: IndieStore's public API lists software/startup profiles, not these merchandise interests; Archive & Atlas exposes art/archive feeds with item-specific licensing and agreement-gated bulk data use. Neither is represented as a relevant authorized merchandise harvester. No repeated marketplace-authentication probing was performed.

### Photography and monitoring improvements

Catalog Studio now shows SQL-aggregated product/image coverage, recorded exact assignments, pending candidate reviews, image-check outcomes and each interest's coverage. Image URL counts remain explicitly separate from exact identity. Candidate review includes the actual product title, licensed Commons preview, image title, attribution and source/license links. Existing owner-only authorization remains in place.

Fixed an additional monitoring defect: isolated feed errors returned by the feed runner now mark the containing maintenance execution unsuccessful. Previously they could appear in nested results while the top-level errors list stayed empty. Other sources still run, and prior valid catalog records remain preserved.

Validation at this continuation: **81 JavaScript tests passed**, including temporary-retailer normalization, stale price/stock suppression, currencies, relevance/URL checks, pagination encoding, redirects, oversized bodies, rate limits, media coverage accounting and propagation of isolated feed failures. TypeScript passes. No new dependency, database schema migration, paid service or hosting identity change was introduced. Production browser verification follows deployment and must be distinguished from these fixture checks.
