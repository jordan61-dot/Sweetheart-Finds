# Stage 2.3 — Official recurring merchandise feed activation

Baseline: Site 14, managed source a4641cb36eadafdeae9276b4e6f1fcd4fc568011; GitHub ebce6239fb5a990affc519022581a73cea087c8e. All earlier product, listing, personal and authentication records are preserved. One append-only migration adds a separate current merchant-feed table and FTS5 triggers. It does not rewrite the reference catalog.

## Source permission evidence

Wildmart's official https://wildmart.md/acp/docs/ explicitly publishes recurring offline full-replacement feeds, instructs consumers to refresh them, remove omitted IDs, verify SHA-256 and avoid current stock/price claims after 30 minutes. The linked ACP specification describes indexing and presentation of supplied product/variant media. This is materially stronger evidence than the previously evaluated shopper REST endpoint. It permits this current feed integration; it does not establish unrestricted historical redistribution or resale of images. Merchant media are remote references shown beside that merchant's exact listing and source ID. No image copies or derivatives are stored. Source suspension hides results and stops checks.

Live feed inspection on November 9 UTC / November 8 Eastern validated **98,813 records, 183,196,194 bytes**, digest **986e6587d4933a8fb67032795a488badbd70ab1f2921af413dd6ce33f30e3ddf**, snapshot 04:17:21 UTC. Streaming took **16.08 seconds**. The broad prefilter retained **69 candidates**; production classification decides final accepted counts. This inspection alone is not production collection evidence.

## Execution and retention

The existing authenticated GitHub scheduler checks the source on each execution and downloads a complete Romanian snapshot only when six hours are due. It verifies the merchant digest, byte count and record count before transmitting the small relevant subset. Invalid or interrupted downloads cannot publish. No complete source snapshot or image is written to disk, GitHub artifacts, repository or the permanent reference backup.

Stable merchant SKU and variant IDs drive transactional upserts. A successful full replacement removes omitted current-feed items and their FTS entries. Source failures retain prior correct records. Removal above 50% pauses publication for investigation. Concurrent source configuration changes abort the transaction. Execution metrics retain only 30 bounded summaries. A failed attempt backs off 1–6 hours; public cards hide after 24 hours without refresh. Prices and stock expire after 30 minutes, including while the page is open. Final buying decisions follow the merchant link.

The image pipeline uses variant-level merchant media first and product-level media only when exactly one source variant exists. It rejects non-approved image hosts. Five pending images per maintenance run receive bounded HEAD/content-type checks; only successful checks publish. Image matching never transfers photographs to another retailer's or historical product. Broken or failed images remain unpublished. Checks retry after seven days; subsequent full snapshots retain previously verified unchanged image URLs.

The new public collection is independently paginated, FTS-searchable and filtered by the same fourteen interests. It preserves MDL and explicitly states Moldova delivery and unknown US eligibility. The original 74-record reference/personal catalog remains separate. Favorites and gift-list attachment for current-feed items are not yet implemented.

## Cost and limits

No added service, account, subscription, paid inference or billing is required. Existing Sites hosting remains a dependency. GitHub confirms standard hosted runners are free for public repositories: https://docs.github.com/en/actions/reference/runners/github-hosted-runners . The collector uses ubuntu-latest, an eight-minute job timeout, streaming memory, no build or artifact upload, a 350 MB maximum download, a 240-second stream deadline, at most 1,500 relevant candidates and a 2 MB ingestion limit. Current scale is about 733 MB/day inbound to Actions at four full snapshots/day. This avoids loading a 183 MB source file into a 128 MB Worker. At 69 retained records, snapshot upserts are approximately 276/day plus FTS/config changes and image checks. Source APIs and authenticated endpoint calls have separate small budgets. GitHub schedule delays and 60-day public-repository inactivity remain operational dependencies; dashboard execution timestamps disclose actual operation.

## Verification status

Local end-to-end SQLite tests cover exact variant/price normalization, stable IDs, FTS, full replacement, stale generations, duplicates, unsafe links, mass-removal preservation, and automatic photo publication only after valid image responses. Production deployment and independent scheduled retrieval must be recorded below before claiming live activation. All fourteen interests retain configurations; actual source coverage is not assumed to cover every interest. Existing historical-photo backfill remains 74 processed, five uncertain candidates and zero automatic exact matches.

## First actual unattended production execution

GitHub run [42562419922](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/42562419922) completed successfully on November 9 at 04:32:54 UTC (November 8, 23:32 Eastern). Trigger: **push**, not cron. Its collector downloaded and verified all 98,813 records in **3.33 seconds on the GitHub runner**, then published **69 new current-feed merchandise records**, with **69 exact source-variant image candidates**. Production database publication occurred at 04:32:52.678 UTC. Five images were independently checked and automatically published at 04:32:53–54. This is real unattended end-to-end publication; a separate cron execution still needs to be observed for the newly activated source.

Production GET `/api/merchant-feed` independently confirmed 69 stored records. Full-snapshot next eligibility was 10:32:52 UTC. The initial Site 15 frontend had a misplaced React client directive and returned a page error while its API remained operational. The directive was corrected and Site 16 restored the page at 04:34:36 UTC. The correction is GitHub commit `8630e1fd431203141d6956f2e0bbd83474f47f92`, managed source `4e5e709ca2f116f39c1c5180391235cc9e3ff110`. No data loss occurred.

## Additional automation

The next continuation adds rotating detail checks for up to twenty stale source IDs per workflow execution, paced at 1.2 seconds/request. The merchant expressly asks feed consumers to use live product lookups; these checks update only existing feed IDs and retain prior values on failures. A valid live response updates price, stock and source-observation time without duplicating the item. HTTP 429/503 stops the remaining batch. The original merchant images are not replaced by unrelated API search photos.

The workflow also drains up to fifteen five-image batches, six seconds apart, so the initial 69-image queue can finish automatically in one bounded execution. It stops as soon as no more images need checking. Every batch retains a production execution record. This remains checkpointed, with no requirement for the owner to press update repeatedly. Total job timeout stays eight minutes. These refinements pass 87 JavaScript tests; production evidence follows publication.


## November 15 production verification

Site 17 deployed at 04:37:37 UTC on November 9 (November 8, 11:37 p.m. Eastern), managed commit `691573368ea250ac773f0c8d88daa825922bc48c`. GitHub `cf05719d78645d155e7f68a9c31a8ef37ca957a8` synchronizes that implementation and activates the live SKU refresh in Actions.

Production history records 20 successful full imports from cron since activation. Latest recorded full import at this check was [43673187599](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/43673187599), November 14 at 10:37 p.m. Eastern. It validated 99,180 source records and retained 69 distinct offers with zero additions, updates, removals or duplicates in that generation. Next eligible full import was November 15 at 4:37 a.m. Eastern, subject to scheduler delays.

The matching push-triggered [workflow run 43686659898](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/43686659898) verified 20 live SKU responses at 1:42 a.m. Eastern on November 15. Public pagination confirmed 19 in-stock, one out-of-stock and 49 stale records afterward. A distinct cron execution of the new rotating refresh was not yet observed. All 69 current-feed records have verified exact merchant photo references. The scheduled snapshot and associated photo maintenance have real production execution evidence.

Current merchant results include 35 Monster High, 27 My Little Pony and seven Hello Kitty offers. The same seven Hello Kitty offers also count under Sanrio. The other ten interests retain historical and external search coverage. The canonical catalog remains 74 products. Historic photo backfill remains at five review candidates with no exact assignments. The original 34 offers were separate from the 69 current-feed offers.

[GitHub verification 43686659850](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/43686659850) passed for the synchronized implementation. Local release validation passed 87 JavaScript, 10 database and four diagnostics tests plus TypeScript and build. Production frontend rendering recovered in Site 16 and was verified with genuine product cards. Additional spending remains $0 with existing Sites hosting and a public GitHub repository.

The core unattended publication and merchant-photo objectives are operational. The full Stage 2.3 scope remains incomplete, including broader authorized merchant and US shipping coverage, exact photographs for legacy records, and saving the separate merchant results to personal collections. Stage 3 has not started.

## Full-catalog stock refresh

GitHub commit `bb1329ac3c98414d734d2ccf2fb2a2520525ec1f` expands the existing workflow to four batches of up to 20 stale offers, with two seconds between lookups and a 170-second budget for starting requests. It stops further lookups on HTTP 429 or 503. The workflow change runs against Site 17 and needs no new site deployment. [Collector run 43686980684](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/43686980684) verified all 49 remaining stale offers in three batches. A production read immediately afterward found 68 in stock, one out of stock, zero stale and 69 verified photo references. [CI run 43686980694](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/43686980694) passed. GitHub scheduler delays can still exceed the 30-minute freshness window. Broader Stage 2.3 scope remains incomplete.

## Snapshot failure recovery

Collector commit `a7274250fa5f0b38a42e1e55aa639869742846c2` keeps existing-offer refresh and photo maintenance running after a full snapshot fails, records the source error and preserves a failed workflow result. A simulated download outage verified that the failure report, stock update and photo maintenance all execute in order. The normal production [collector run](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/43687962070) and [foundation verification](https://github.com/jordan61-dot/Sweetheart-Finds/actions/runs/43687962147) passed. The change runs in GitHub Actions and requires no new site deployment or spending.


## Additional feed activation

Prioritize merchant consent over another general-purpose crawler. The current scheduler already supports authorized JSON and CSV feeds, conditional retrieval, leases, retries, product/variant identity, matching, and source-linked photography. An existing export is sufficient when the merchant approves its use.

| Lead | Verified access condition | Next action |
| --- | --- | --- |
| eBay Browse API | Production Buy API use requires an approved application. Official bulk feeds target eligible partners. | Apply for Browse production search and item lookup first. Request the exact display, image and caching rules for the approved use before enabling recurring collection. |
| HobbyLink Japan | Official affiliate program provides a merchant contact path. A recurring product export and reuse rights are unverified. | Ask for a feed and US shipping fields. |
| Independent specialty retailers | Current owner-configured JSON/CSV integration accepts permissioned exports. | Ask for an existing export limited to relevant merchandise and confirm refresh and display rights. |
| Disney Store via CJ | CJ advertises a product feed and requires an active publisher account and application. | Lower priority since fit with the 14 collections is unverified. |
| Agentsfeed and ACP directories | Protocol documentation describes public feed routes. It does not identify a relevant consenting merchant by itself. | Evaluate individual merchant listings when a matching catalog is found. |

Official evidence:
- https://developer.ebay.com/api-docs/buy/static/buy-requirements.html
- https://partnernetwork.ebay.com/solutions/scale-listings-on-your-site-with-data-feeds
- https://support.hlj.com/hc/en-us/articles/360006252733-Do-you-have-a-partnership-sponsorship-or-affiliate-program
- https://public.cj.com/signup/publisher?advertiserId=2609575

### Ready-to-send merchant request

Subject: Product feed for Sweetheart Finds

Hello, I’m looking to feature your relevant collectibles on Sweetheart Finds, a small shopping discovery site that links buyers directly to the original store. Do you offer an existing JSON or CSV catalog export for periodically refreshing product names, SKU or variant IDs, listing URLs, prices, and stock? We’re especially interested in Sanrio, Monster High, Littlest Pet Shop and related collectibles. If you offer a feed, please share its documentation, US shipping coverage, allowed refresh interval, and retention terms. Please also confirm whether we can display your supplied product image URLs alongside the corresponding listings. We can launch with listing text and links if photo display is unavailable. Site: https://sweetheart-finds.jordanmullens12.chatgpt.site

### eBay production application description

Sweetheart Finds helps shoppers discover character merchandise and vintage collectibles across 14 interests. We request production Browse search and item lookup access for relevant eBay listings, including listing identity, item condition, price/currency, availability, shipping to the United States and images when permitted. Buyers complete orders on eBay. We will attribute listings, link to the approved eBay destinations, follow freshness, retention and image rules, and keep partner credentials server-side. Please confirm whether recurring refresh of a bounded relevant listing set is permitted and, if so, the required retention window.

### When access is issued

1. Record the merchant's exact refresh, indexing, retention and image permissions. Continue with text and links if only that use is approved.
2. For a compatible feed, allowlist its exact HTTPS hostname and any separately approved image hosts in Sites, then register it in Catalog Studio. Use a targeted export of at most 250 records and 1.5 MB, or build a dedicated streaming adapter for larger feeds.
3. Verify one new real listing and one stable-ID refresh in production, then check the next scheduled execution. Use secure runtime configuration for credentials if the source requires them.

No additional merchant has been activated by this evaluation. A confirmed approved feed or production credentials are still needed. No applications or external messages were sent.
