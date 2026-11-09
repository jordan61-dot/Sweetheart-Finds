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
