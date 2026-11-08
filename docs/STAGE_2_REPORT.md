# Sweetheart Finds — Stage2 engineering report

November7,2026. Baseline1.1 preserved; Stage3 has not started.

## Status

Stage2 overall remains **INCOMPLETE** because operational merchant integrations, recurring product feeds and authorized imagery are still blocked. The stage2.2 recovery continuation is ready for publication. This release adds a substantial discovery foundation and genuine current merchandise. Broad unattended marketplace aggregation is not yet established. A source profile, mocked adapter or external search link is never counted as a working product collector.

## Preservation and architecture

Existing React19/TypeScript/Vinext Worker, D1/SQLite, Drizzle and FTS5 remain. Production origin, DB binding, canonical IDs, local-storage keys, account authorization and original migrations are preserved. A fresh private backup contains49 products,11 listings,11 observations,83 product-category relationships,1 account-personal row,1 ingestion row and configuration. Restoring the full backup into a new isolated SQLite file returned identical counts and `integrity_check=ok`; the restore command refuses an existing destination. No private database or credential is in GitHub.

Workspace maintenance removed unpublished working files before this continuation. They were reconstructed from retained work/evidence, independently revalidated, and checkpointed to GitHub branch `stage2-work` at79a57cfc4dacf4fc37655c1958e12a338099b885 before additional work. Original source and database remained intact.

Append-only migration `0001_discovery_foundation.sql` adds transactional write guards, discovery jobs/checkpoints, source health, match review and lookup indexes. Matching Drizzle metadata is included; initial migrations are unchanged. Catalog writers snapshot a shared epoch and check it inside their transactional batch. Concurrent stale edits/imports/merges roll back with409. Within-batch duplicates consolidate rather than overwrite offers. Merge redirects are compressed; archived source identities, offers, observations and original private notes remain. Notes from merged identities are displayed separately when the target already has a note.

## Discovery infrastructure

- Modular policy register distinguishes human-triggered API references, reviewed offers, owner-authorized imports, bounded collectors, credential-gated APIs and external alternatives.
- Every one of the14 interests has bounded, deduplicated character/type/generation queries, including Japanese terminology and rare-category priorities. Source classification rejects legal Justice, musical Mezzo Piano and generic cookie-crumb collisions; Limited Too is not an identical Justice product alias.
- Open Library remains a functioning human-requested reference adapter. Owner jobs have atomic claims, duplicate-open-job protection, cancellation, page checkpoints, max3 attempts, exponential cooldowns, health reporting and a shared24-request/day source budget. Results await review, never imply sale stock, and may be imported through the existing validation pipeline.
- Source transport uses a fixed endpoint allowlist,15-second timeout, redirect rejection,2MB response bound, quota diagnostics and no arbitrary submitted-URL proxy.
- Owned P256 public UCP profile and RFC9421/WBA signing adapter are implemented. Signatures pass local verification. Prior real Sanrio requests returned401 `signature_missing`, including signed attempts; JapanLA also rejected anonymous access. Product access to other advertised merchant endpoints is unverified. The owner can perform one bounded signed runtime handshake/source/day to distinguish the application runtime from development transport. No bypass or retry loop is enabled.
- UCP normalizers retain source and variant IDs, currencies, explicit stock, pagination and malformed-record isolation. They copy no merchant HTML/photos. Shopper results expire15min and cannot be permanently imported. They do not authorize a standing commerce index.
- The retained Schylling collector now converts directly into safe import-preview records, respects the retailer pause, and rejects oversized responses. It remains manual-only; no new source collection success is claimed solely from fixture tests.

## Genuine merchandise expansion

[data/stage2-reviewed.json](../data/stage2-reviewed.json) contains23 distinct factual offers from six storefronts, with stable IDs, exact URLs, original currencies, chosen variants, timestamps and stock evidence. Initial observations were recovered faithfully. A new bounded verification confirmed22 positive InStock offers across all14 interests; prices were unchanged. One ToyWiz Starshine request failed with a tunnel403 and was not retried. That prior observation is preserved and becomes stale. Failure is never treated as sold out or a fresh success.

The22 original price/currency observations are retained alongside refreshed observations; no invented price history, checkout, shipping promise or rarity claim is added. Historical reference identities are not purchase offers. See [source research](STAGE_2_SOURCE_RESEARCH.md) for each record and source restrictions. No new retailer product images or descriptions were copied. Existing13 image URLs remain; image rights are an unresolved coverage limitation.

| Source | Reviewed identities/offers | Method |
| --- | ---: | --- |
|ToyWiz|11|Individual primary-source review;10 refreshed,1 prior observation preserved after failure|
|Sanrio Japan|8|Individual official product observations; JPY and unknown US eligibility retained|
|Toynk|1|Crumbs costume; selected size retained|
|Narumiya Online|1|Mezzo Piano pouch; JPY, unknown US delivery|
|Super Monkey|1|Actual Crumbs doll, source model and KWD retained|
|Walmart|1|Justice shoes; selected Leopard /4 Big Girl; seller Walmart.com|

Source requests used permitted bounded factual review rather than mass scraping. This does not establish recurring feed access or image redistribution rights. API sources eBay, Etsy, Bonanza and current Rakuten require developer credentials/eligibility. Mercari, Poshmark, Depop, Facebook Marketplace and other unapproved retailers remain external-search candidates. Mandarake's advertised RSS redirected to HTML; no RSS collector success is claimed.

## Shopping integration

Available Now uses source-specific expiry and explicit observed stock; stale/unknown offers cannot qualify. New filters include US shipping eligibility. Sorts include known item+shipping, current seller count and oldest release. Unknown shipping is never zero, and taxes/duties remain unknown. Currencies are retained without unsupported conversion, including KWD. Offer comparison keeps each seller/condition/variation/region/observation separate and prioritizes current evidence. Existing price/stock history remains visible. Search now includes variants, seller/source and collector fields; existing fields are reindexed in the controlled release backfill.

## Automation, monitoring and budgets

The source dashboard exposes policy/access, request budgets, errors, successful jobs, checkpoints, review queues and category coverage. No eligible unattended product harvester is enabled. A weekly public GitHub Actions workflow checks only five advertised discovery profiles, with max5min, concurrency cancellation, standard public Linux runner, no private credentials, production writes or artifact uploads. It is not scheduled product collection; a committed schedule does not prove execution occurred.

Hosting stays included with the owner's existing eligible ChatGPT plan. No new subscription, card, credit purchase, auto-reload, paid API, proxy, inference, storage or CDN was introduced. Human reference requests fail closed at24/day; runtime handshakes at1/source/day. Current hosting has shared limits and10GB/database; exact traffic allowances are not exposed by project tools. Retain source/data portability and do not opt into paid overages. No perpetual third-party pricing guarantee is asserted. Public standard-runner CI and the portable Python/SQLite tools add no required expenditure.

## Performance and QA

Reproduce the isolated1k/10k/100k synthetic benchmark with `npm run benchmark`; results are in [benchmarks/stage2-sqlite.json](benchmarks/stage2-sqlite.json). No synthetic merchandise touches production. In the latest local100k run, the former category pattern measured85.435ms median, the indexed24-row EXISTS query0.015ms, and broad FTS94.725ms. This measures SQL query patterns with warm cache, not overall website speed, D1 latency or phone hardware. Broad FTS/count queries remain scale risks. Listing statistics now aggregate in SQL rather than materializing every offer in Worker memory; facets are capped at300 combinations.

The original tests are retained. Added checks cover all14 query configurations, precise classification, identifiers/variants, source freshness, delivered cost uncertainty, backoff, transport denial/malformed/oversized responses, signature verification, UCP normalization/pagination, blocked-source fail-closed behavior, source package integrity, Schylling conversion and retained private notes. SQLite tests cover append-only migration, simultaneous edit/ingestion, batch rollback, atomic job claims, duplicate jobs, cancellation, source-failure stock preservation and backup relationships. Exact final test/build/production results are recorded after deployment below.

## Remaining acceptance limits / Stage3 readiness

Stage2 cannot be certified fully complete while broad operational product APIs, permissioned recurring feeds, meaningful automatic multi-marketplace refresh and permitted imagery remain absent. The signed runtime handshake is an integration diagnostic, not approval to mass collect. Account/API approvals and retailer permissions are genuine external dependencies. Additional production-scale D1, exhaustive mobile/accessibility and separate non-owner-session checks remain. Source matching supports review; no uncertain record is automatically merged. Stage3 has not started and should not be accepted on the strength of unperformed discovery work.


## Stage 2.2 continuation — November 7, 2026 (Eastern)

- Recovered the retained unfinished patch against the deployed source, which matches GitHub main 661a941 except its excluded environment example. No schema, identity or personal-data migration was made.
- Completed a separately testable discovery engine: atomic claims, lease checks on late responses, recovery after two minutes, three-attempt ceiling, shared daily source budget, Retry-After cooldown, and explicit next-page queueing capped at 20 pages per human-driven job. The retained review data is kept until the next request completes.
- Full owner-only transactional backups now include discovery jobs, source diagnostics and match reviews. Restore supports foundation v1 and complete v2 snapshots into a new isolated file; it refuses overwriting an existing destination. Current catalog-sized snapshots are tested; very large full snapshots remain subject to Worker/D1 memory and response limits.
- Corrected integer minor-unit normalization for currencies including USD, JPY and KWD, without exchange-rate conversion. Conflicting strong identifiers take precedence over weaker matches. Transport rejects redirects and honors HTTP-date Retry-After values.
- Verified live stored diagnostics: Sanrio, Mattel, JapanLA, Blippo and Toynk signed runtime probes all returned HTTP 401 on November 7 UTC. Open Library has a successful production reference lookup. No repeat probes were performed in this continuation.
- Passed 50 JavaScript checks (including actual SQLite-backed job races and a full backup/restore round trip), 10 Python database checks, four profile-diagnostic checks, TypeScript checking and the production build after clean dependency installation. Framework sourcemap/dynamic-import warnings remain nonfatal.
- Browser preview: migrations applied only to an isolated local database; 72 records loaded, Usahana search returned six relevant records, and a saved favorite persisted after reload. Local shell could not reach the browser daemon's loopback URL; browser QA itself succeeded. Physical phones, full screen-reader coverage and signed-in owner UI were not tested in this continuation.
- No new paid service, API, credential purchase, billing setting or overage was enabled. Existing included hosting and public-repository CI remain the deployment path.

### Concrete external completion blockers

Merchant integration needs accepted production client credentials or approved agent authentication from the retailer/platform. Recurring product collection requires a source permitting that use and a verified free execution path. Product photography requires suitable display/reuse rights. External search links and individual manual observations remain usable fallbacks; neither fulfills automatic multi-marketplace collection. Stage 3 has not begun.
