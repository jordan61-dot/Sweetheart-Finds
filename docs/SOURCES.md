# Sweetheart Finds initial source assessment

Observed 7 November 2026. This is an engineering source assessment, not a grant of third-party rights.

## Delivered factual seed records

- `schylling-products.json`: 11 canonical distributor records; 8 Littlest Pet Shop and 3 My Little Pony. Ten have consistent observed USD asking prices. One price is withheld for a source currency conflict. All are unavailable because the retailer explicitly pauses new orders; structured `InStock` or an Add to cart control cannot override that notice. No active verified listing should be counted. No seller descriptions or photos were copied.
- `book-reference-selected.json`: 10 bibliographic merchandise references, selected from six bounded user-interest searches. LPS 3; Shopkins 2; Lalaloopsy 2; Monster High 2; Hello Kitty/Sanrio 1. Book records have no sale price, seller, stock, or condition. Source IDs, authors, ISBNs, and publication years are factual API metadata. They are not live listings.
- `collect_schylling.py`: reproducible Python-standard-library collector for 11 exact no-query public URLs. Reads robots first, respects its 3-second delay, uses identified read-only agent requests, limits response size, persists record/source hash/error observations, and does not copy copyrighted descriptions or images. Tested real run: 11 records, zero source failures. Python compilation passed. No unattended recurring job is enabled.

## Schylling

Public product metadata is provided using schema.org Product JSON-LD. Current robots https://schylling.com/robots.txt allows ordinary product paths, disallows query URLs, and requires Crawl-delay 3. The collector makes serial requests and avoids all query URLs, account, cart, checkout, and access-controlled paths. Public footer review found privacy, ordering/shipping, toy safety and security links, but no separately accessible general Terms of Service page; privacy mentions associated Terms of Service without providing that document. Do not characterize this as an explicit content/photo reuse license. Recheck policy or obtain permission before aggressive recurring collection. Source imagery rights were not established and are withheld.

The source currently displays: “taking a short pause on new orders”. The application should display unavailable/retailer paused and retain timestamped price observations, without claiming listings can be bought.

Exact source URLs are included in every record. Representative product:
https://schylling.com/product/littlest-pet-shop-pet-surprise/

## Open Library

https://openlibrary.org/developers/api documents supported human-centered book discovery and batch lookup. It allows caching; anonymous limit 1 request/sec and properly identified name+contact requests 3/sec. It explicitly prohibits bulk API harvesting and using the API as a high-traffic third-party data backend. Use on-demand bounded lookups with caching, not a scheduled bulk collector. Large catalogs should use monthly dumps or contact Open Library.

https://openlibrary.org/developers/licensing states the Internet Archive asserts no new rights over the database, while warning that existing rights can apply to contributions/jurisdictions. Never label book covers CC0 simply because metadata is open. Public Covers API display is documented separately, but does not create an all-purpose reproduction license for underlying cover art.

The full `book-reference-products.json` is research cache only and MUST NOT be blindly imported: broad title search returns unrelated collisions (e.g. a 1960 Monster High title). Selected10 were screened for relevant merchandise titles. Stronger edition/publisher validation is advised when expanding.

## Sanrio UCP and current terms

https://www.sanrio.com/agents.md and robots explicitly advertise public read-only browsing and supported UCP tools, with identity/authentication requirements. https://www.sanrio.com/.well-known/ucp is a working discovery profile. `tools/list` against the advertised MCP endpoint returned a live tool schema, saved in `sanrio-ucp-tools.json`; includes `search_catalog`, `lookup_catalog`, `get_product`. This is a promising authorized-integration route.

`search_catalog` requires a real hosted `meta.ucp-agent.profile` URI and accepts catalog.query, country/currency context, filters and pagination. Agent guide requires Web Bot Auth for server-to-server/hosted requests. No registered identity/signing key or hosted agent profile was available in this research task; no identity was fabricated and no product-data API call was made.

Both https://www.sanrio.com/pages/terms-of-service and https://www.sanrio.com/policies/terms-of-service retain section 6.14 restricting retrieval/indexing and broader content reuse restrictions. The advertised supported API is more specific than legacy blanket website terms, but the required identity and API usage rights should be resolved before collection. Do not scrape products.json or assume a reachable endpoint grants image reuse. No Sanrio product data or photos were imported.

## Other reviewed sources

- Moose Toys https://www.moosetoys.com/terms-of-use explicitly restricts automated or manual monitoring/copying in Permitted Use paragraph e. Do not build a scraper without permission; external links or properly licensed feeds remain alternatives.
- Narumiya global https://www.narumiya-global.com/en_US/terms.html grants limited personal browser shopping access and excludes third-party use absent permission. No automated product ingestion was attempted.
- Justice shop robots returned 503 during research. No catalog or product availability claim is supported by that failure.
- littlestpetshop.com robots returned 403. Official product pages were readable through web retrieval, but no automated bulk collector or image reuse was enabled.
- The follow-up assessment found licensed Commons editorial photographs; see EDITORIAL_SOURCES.md. No franchise logo or unrelated photo is substituted as an item image.

## International discovery terminology

Use U*SA*HA*NA / U SA HA NA / Usahana / ウサハナ for character discovery, and mezzo piano / メゾピアノ / メゾ ピアノ for the fashion brand. Justice queries should include girls clothing/fashion to suppress unrelated legal/social-justice results. Limited Too is related brand history, not an automatic identical-product alias. Crumbs Sugar Cookie queries should retain the full character name and Lalaloopsy; avoid generic Lalaloopsy results as character-specific matches.

## Stage 2 integration priorities

1. Establish a real UCP agent profile and compliant Web Bot Auth identity, resolve product/image usage permissions, then implement bounded live Sanrio catalog search.
2. Seek retailer/manufacturer-approved catalogs/feeds and media permissions before broad scraping.
3. Add supervised classification, identifier/variant matching, region and currency validation.
4. Add listing re-verification and source-wide availability overrides before active counts or deal claims.
5. Keep manual factual entry + user-authorized JSON/CSV importing available across all14 categories.
