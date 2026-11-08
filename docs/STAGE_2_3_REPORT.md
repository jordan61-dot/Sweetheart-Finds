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
- Service-authenticated bounded collector endpoint and hourly GitHub Actions workflow. A missing secret reports an inactive collector. It is not proof of scheduling or live collection.
- Exact source-product/variant image matching, identifier and generation conflict rejection, permission checks, image MIME/availability verification and automatic publication for qualifying feed photographs. Expired new image permissions hide those images in browsing and detail galleries.
- Resumable existing-product Commons candidate discovery, explicit per-file license metadata, source attribution, human exact-product confirmation/rejection and guarded publication. Candidate discovery alone does not prove a suitable photograph exists. No automatic publication based on franchise names or title similarity.
- Catalog Studio feed controls, execution histories, overdue indicators, photo decisions and resumable backfill controls.
- Manual reference-update button no longer tries to execute an already reviewed/running job. Existing reviewed results remain in the job panel.

## Sources and actual automation

| Route | Current authorization / output | Scheduler |
| --- | --- | --- |
| Participating merchant JSON/CSV | No approved URL or source permission supplied; zero registered production feeds | Implemented, inactive pending source and secure service configuration |
| Bonanza | Official developer application explicitly requires approval before marketplace access; no authentic developer ID supplied | Disabled |
| Etsy | Official Personal App review is required for this buyer-facing use case; seller-only access is not a substitute | Disabled |
| Rakuten Ichiba | Current 2026-07-01 documentation requires applicationId plus accessKey; neither supplied | Disabled |
| eBay | Production eligibility and applicable Buy API agreements must be established for the application; no production credentials supplied | Disabled |
| Shopify UCP merchants | Prior five signed HTTP 401 observations retained; no new handshake loop | Disabled |
| Open Library | Existing human-triggered reference lookup, no sale stock | Manual only |
| Wikimedia Commons | Public licensed-media search; per-file license and identity review required | Owner-triggered resumable backfill |
| RSS/Atom/XML and affiliate exports | No approved relevant export established in this release; parsing adapters not implemented | Disabled |

New merchandise imported automatically in production: **0 as of preparation**. Updated merchandise listings through the new scheduler: **0**. No scheduled execution evidence is claimed. No approved source was fabricated to satisfy acceptance.

Official evidence checked 2026-11-08:

- https://api.bonanza.com/accounts/new and https://api.bonanza.com/docs/reference
- https://developer.ebay.com/api-docs/buy/buy-requirements.html
- https://developers.etsy.com/
- https://webservice.rakuten.co.jp/index.php/documentation/ichiba-item-search
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical/en
- https://docs.github.com/en/actions/concepts/billing-and-usage

## Owner actions that unlock live collection

The shortest direct route is one cooperating retailer granting recurring retrieval, durable catalog retention and product-image display for a JSON export. Alternatively obtain approved marketplace access; an account or publicly readable storefront alone does not establish those permissions. The connector available in this session cannot set GitHub Actions secrets.

Application description: “Sweetheart Finds is an independent personal collectibles discovery site. It helps a small audience find character merchandise and links directly to original seller listings. It does not process purchases, resell data, impersonate the marketplace or infer stock from failed requests. We request authorized item search/lookup, prices, variant identifiers and listing-context image display, with source-approved refresh and retention limits.”

Do not paste developer credentials into the public repository, feed JSON or a chat report. Configure secrets server-side. See `PERMISSIONED_FEEDS.md` for the runnable feed contract and activation steps.

## Testing and limits

Initial completed checks: 63 JavaScript tests, ten SQLite database tests and TypeScript checking. The feed integration tests exercise the real catalog writer, FTS, observations and transaction guards against isolated SQLite with fixture HTTP responses. They prove implementation behavior, not access to a retailer.

Tests cover stable identities, incompatible variants, image rights, unsafe URL rejection, conditional requests, idempotent imports, checkpoint continuation, failure preservation, active-run exclusion, revision conflicts and collector authentication. Existing personal-data and backup regression tests remain passing.

Not yet proven: unattended production collection, approved retailer API integration, multiple real scheduled runs, exact-product photo backfill success, large-scale load/concurrency, comprehensive mobile/accessibility regression and every requested media administration feature. XML/RSS/Atom parsing, dedicated media tables, media embeddings, automated broken-photo rechecks and broader marketplace adapters remain outstanding.

## Cost controls

No new paid service, billing account, proxy, image processing API or storage binding. Images use authorized remote URLs; no caching/derivatives are created. Existing ChatGPT Sites hosting/account remains a dependency. Its account-specific hosting quotas are not exposed here, so unlimited free capacity is not claimed.

GitHub documents standard hosted runners as free for public repositories. This workflow uses ubuntu-latest, one concurrent job, a three-minute job ceiling and a 90-second HTTP ceiling. Do not move it to a private repository or paid runner without checking account quotas. Scheduled GitHub workflows can be delayed and public-repository schedules can be disabled after inactivity; owner monitoring and periodic repository maintenance remain necessary. No perpetual-scheduler promise is made.

At most two due feed pages run per tick, ten records/page, one image HEAD check per record and thirty history entries/feed. Photos must pass separately configured image-host approval. Resource consumption must be measured before adding many merchants; the current zero-feed deployment has no merchandise collection traffic.

## Stage 2 outlook

Stage 2 remains incomplete. The application can now execute a permissioned feed-to-catalog pipeline, but genuine live merchandise and scheduled-execution evidence require approved source access and service activation. Stage 3 has not begun.


## Continuation — November 8, 2026

Production version 9 was deployed from `f537b40397c36a20653ff17c74f9dd64bfca922c`; GitHub implementation commit is `bb7816459031f352f367ab7b7b4d79da9d5519cf`. GitHub Verify foundation run 42448184093 succeeded. The independent production smoke suite passed its routes, authorization boundaries, all fourteen category queries, book sorting and typo correction. The new owner endpoint rejected anonymous requests (401), and the then-unconfigured service endpoint returned 503.

The production Commons backfill completed all **74 products**, finding **five candidates**. None was auto-published; exact identity is unresolved. Product/offer counts remain **74/34**, with **14 image-source records (18.92%)**. As of the morning check, all prior stock observations had expired: **zero source-current offers**. This is expiration, not a claim that all offers sold.

The shared-secret activation dependency has now been replaced in source by GitHub OIDC authentication. It pins the numeric repository ID 1449222249, owner ID 348051783, exact main-branch workflow, expected audience, issuer, public repository, hosted runner and permitted event types. JWT signature and time checks plus persistent one-use token claims prevent anonymous calls and replay. Forks and pull requests cannot invoke the writer. No long-lived scheduler secret or new account is required.

The workflow now ticks every fifteen minutes; each source still retains its own due time and budget. It performs bounded eligible-feed work, resumable photo discovery and one existing-product image availability audit, retaining execution event/run IDs and history. A successful media audit verifies URL/MIME availability, not exact collectible identity. Real scheduled execution evidence must still be appended after it is observed; source code alone is insufficient.

The repository remains public. No paid infrastructure was introduced. GitHub standard runners are covered by its public-repository free usage, while the existing Sites subscription remains a hosting dependency. Updated unit suite: 68 passing tests, including actual RSA signature verification and rejection of forged, expired, wrong-repository and wrong-workflow credentials.
