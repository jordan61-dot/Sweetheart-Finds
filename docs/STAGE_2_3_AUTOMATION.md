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
