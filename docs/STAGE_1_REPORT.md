# Sweetheart Finds — Stage 1 development report

Version 1.0.0 · November 7, 2026

Sweetheart Finds is an independent application with its own source history, product catalog, database, personal records, and deployment. Explorer was not modified. This is a functional platform foundation with modest real-source coverage; internet-wide live shopping coverage remains future work.

## A. Architecture

The application uses React 19, TypeScript, Vinext/Vite, a Cloudflare Worker, and D1/SQLite with Drizzle migrations. Zod validates products, listings, imports, and personal changes. FTS5 supports indexed full-text/prefix lookup, with substring fallback, category aliases, and bounded typo correction.

Canonical merchandise identities are separate from seller offers and timestamped price/stock observations. Categories have structural parent relationships; extensible metadata holds generations, pet numbers, species, molds, seasons, releases, region, variants, licensing, confidence, and provenance. Stable IDs, unique identity keys, transaction batches, and soft archive protect records.

Personal data is account-scoped, with browser copies and retry queues. Compare-and-swap revisions and operation IDs protect account updates. No personal records are sent to merchandise sources. The private deployment uses platform sign-in and owner-restricted catalog administration.

## B. Implemented functionality

- Pastel boutique interface, original gift illustration, licensed editorial photography, light/dark themes, mobile navigation, touch layouts, keyboard focus, semantic controls, and reduced-motion handling.
- Homepage discovery, collection directory, all 14 dedicated category pages, character and generation navigation, universal search, history, suggestions, highlighting, and typo correction.
- Combined filters for collection, character, brand, type, price/currency, condition, source, generation, region, availability, licensing, vintage/limited classifications, variations, and identification confidence.
- Sorting by relevance, price, addition/observation date, alphabet, year, and actual saved personal-interest signals on the current results page. Pagination, grid/list modes, and comparison of up to four products.
- Detailed canonical product views with images when sourced, offer lists, historical announced-price labels, collector metadata, provenance, price/stock observations, related collection navigation, and external marketplace searches.
- Persistent favorites, named gift lists, list membership, notes, owned/purchased status, desired prices, interest profile, and portable versioned personal backups with merge or exact restore.
- Catalog Studio with counts, source provenance, reviewed JSON/CSV importing, validation errors, duplicate matching, URL/manual additions, correction/reclassification, soft archive, duplicate identity redirects, custom characters/aliases, failed-operation activity, catalog export, and source/scheduling status.

## C. Catalog status

| Metric | Stage 1 baseline |
| --- | ---: |
| Canonical product records | 49 |
| Recorded seller offers | 11 |
| Active verified offers | 0 |
| Historical/reference records | 38 |
| Source labels | 8 |
| Distinct canonical IDs / fingerprints | 49 / 49 |
| Duplicate baseline identities found | 0 |
| Products with cover-image URLs | 13 |
| Separately licensed editorial photographs used | 1 |
| Records with release years | 33 |
| Records with SKU identifiers | 15 |
| Records with named characters | 21 |

All 11 seller offers belong to Schylling and are unavailable because the retailer had paused orders. Ten have consistent observed USD asking prices. One conflicting price/currency was withheld. Historical launch prices are held separately and never displayed as current seller offers. No demonstration merchandise is included. Cover URLs do not guarantee that an image exists or will load.

| Interest | Records |
| --- | ---: |
| Littlest Pet Shop | 11 |
| My Little Pony | 3 |
| Shopkins | 2 |
| Num Noms | 3 |
| Crumbs Sugar Cookie | 1 |
| Lalaloopsy | 3 |
| Monster High | 2 |
| Sanrio | 21 |
| Pompompurin | 3 |
| Hello Kitty | 2 |
| My Melody | 12 |
| Usahana | 4 |
| Mezzo Piano | 12 |
| Justice Girls | 4 |

These counts overlap: characters also appear under their parent franchise, and collaborations may have multiple collections.

## D. Discovery infrastructure

| Source | Records | Functioning path / limit |
| --- | ---: | --- |
| Schylling | 11 | Bounded, robots-aware factual JSON-LD collector; 11 successful source reads, zero failures; serial delay at least 3 seconds; no descriptions or artwork copied |
| Open Library | 13 | Selected bibliographic references plus modular human-triggered live lookup; 12 source results per requested page; 24-hour cache; no bulk harvesting |
| Narumiya / PR TIMES | 12 | Original factual editorial references to official fashion announcements |
| KThingS / PR TIMES | 4 | Usahana announcement references; original release years remain unknown |
| Samantha Thavasa / PR TIMES | 3 | Pompompurin collaboration references with historical launch metadata |
| NASCAR official announcement | 4 | Named Justice clothing styles, with current stock/prices unknown |
| Strong Museum | 1 | Specific historical Crumbs Sugar Cookie doll identity; museum photograph omitted |
| Smithsonian | 1 | Open factual Hello Kitty toy-camera metadata; direct retrieval issue retained in source evidence |

All categories support manual source URL entry and reviewed JSON/CSV import. Six correctly encoded shopping-search destinations cover eBay, Mercari, Etsy, Google Shopping, Yahoo! Japan Auctions, and Rakuten Japan. They are explicitly external searches, not six integrated live catalog feeds.

The source-adapter interface supports further providers without changing product or personal-storage contracts. No unattended collector or alert job is active. Scheduler configuration records manual mode and rejects enabling a nonexistent job. Sanrio UCP tools were identified, but compliant hosted agent identity/Web Bot Auth and product/image use terms remain unresolved; restricted website extraction was not substituted.

## E. Testing and verification

- 19 automated domain/ingestion tests passed: every baseline record validates; all14 interests are represented; IDs/fingerprints are unique; prices and stock stay unknown when missing; source URL validation; alias/Japanese lookup; CSV quoting and errors; idempotent favorites; wishlist operations; exact backup restoration; merge preservation; listing freshness; real preference signals; relevant book normalization; source-field omissions; and reserved-key rejection.
- 5 isolated SQLite tests passed: schema/FTS triggers, foreign-key transaction rollback, account revision conflicts, currency/null-price handling, and injection values remaining data.
- TypeScript checks and the production Worker build passed during development. The final source is built again during packaging.
- Browser checks verified typo correction, product details, favorites, gift-list creation and membership, exact shopping-note persistence after reload, and navigation to every one of the14 category pages.
- Desktop layout and a 390 × 844 CSS-pixel browser frame were visually inspected. The collection page had no horizontal content overflow at its actual375-pixel content width. A mobile hero text/illustration overlap was found and corrected.
- This was browser-based verification, not Galaxy S26, iPhone, or other physical-device testing. Formal accessibility certification, load testing, universal offline launch, and a full authenticated cross-device test are not claimed. Managed preview has no signed-in visitor identity; restricted operations fail closed there.

## F. Deployment and reproduction

Production destination: https://sweetheart-finds.jordanmullens12.chatgpt.site

The application is published owner-private. Source and version history are maintained in its independent managed repository. The source manifest retains its exact Site identity; no paid domain or separate service account is needed. Publication success and the saved source revision are reported in the final delivery.

The repository README has exact installation, database-migration, test, build, preview, authentication, backup, and continuation instructions. Local development uses Node/npm, Python for optional collection/database tests, and SQLite through local Worker tooling. It requires no paid API or cloud account. Apply schema migrations once per local database; publishing applies hosted migrations separately. Keep the existing production origin and storage keys for future stages.

## G. Cost verification

| Component | Mandatory additional cost / constraint |
| --- | --- |
| ChatGPT Sites hosting + D1 | $0 additional under the existing Plus account; included plan access is required; current documented database limit is10 GB per Site, with shared account limits |
| React, TypeScript, Vinext, Vite, Drizzle, Zod, Lucide, local Worker tooling | Free software; locked dependencies and licenses remain in the source distribution |
| Open Library API and Covers API | No key/payment configured; respect human-driven usage, cache, and source rate limits; covers remain attributed to rights holders |
| Schylling collector | Standard-library Python, no paid scraping service; bounded source access and robots delay apply |
| Official factual announcements / museum references | No paid integration; attribution and usage basis recorded; no universal content-reuse license asserted |
| Google Fonts | Free font delivery with system fallbacks |
| Wikimedia Commons editorial image | CC BY-SA4.0 attribution, license link, and share-alike obligations retained |
| External shopping searches | Ordinary outbound search links; no purchase, checkout, affiliate account, or paid API |

No card, billing account, trial, paid API key, overage setting, or auto-upgrade was enabled. Hosting prices and third-party terms can change; the code cannot guarantee another provider's future pricing. If included hosting ceases, pause it or run locally before accepting any cost. No automatic paid fallback exists.

## H. Remaining limitations

The platform is useful for browsing and organizing discoveries, but its live shopping coverage is limited. All recorded offers are currently unavailable; there is no claim to have comprehensively indexed resale marketplaces. Non-book item photography remains sparse because reuse permissions were not established. Books may have multiple editions or incomplete metadata, and source relevance still benefits from owner review.

No universal arbitrary-URL scraper, automatic counterfeit authentication, rarity valuation, currency conversion, shipping estimator, price alerts, collaborative note editor, or unattended collector is implemented. Personal sorting uses franchise/character/type preferences on the current result page; colors, aesthetics, desired finds, and dislikes are stored for reference and later recommendation work. Offline copies cover loaded/saved views and edits, not guaranteed offline cold launch. Large import batches and shared-host quotas can require smaller batches. Account/administration runtime checks need an authenticated session; deployment does not weaken access to permit anonymous testing.

## I. Stage 2 readiness

The Stage 1 baseline includes source, migrations, real product records, source evidence, modular ingestion, maintained personal contracts, backup formats, and a concise continuation handoff. Prioritize lawful live retailer/resale feeds and exact variants, source-authorized item photos, stock/shipping verification, and broader coverage across all14 interests. Resolve the Sanrio UCP identity/rights requirements before using its catalog tools. Add recurring collection only when there is an actual approved zero-cost execution path and source permission.

Preserve this independent application, all personal data, deployment identity, source history, and the $0 additional-cost rule.
