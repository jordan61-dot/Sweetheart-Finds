# Stage 2 source access research

Research date: November 7, 2026. This assessment distinguishes endpoint discovery, actual authorized merchandise responses, manual source observations and blocked integrations. No account was created, agreement submitted, paid service enabled or retailer restriction bypassed during this research.

Recovery note: this document and its 23-record factual dataset were reconstructed from retained task/tool evidence after workspace maintenance removed the uncheckpointed working files. Original listing URLs, prices, currencies, IDs and observation timestamps are retained. Two optional HTTP Date values that were not recoverable were omitted; no observation timestamp was refreshed. This is not a claim of byte-for-byte recovery of optional editorial wording. The observations must expire normally and may now be stale.

## Priority finding: Sanrio's UCP storefront interface

The actual `https://www.sanrio.com/.well-known/ucp` response returned HTTP 200. It advertises UCP `2026-08-25`, with older profiles `2026-04-08` and `2026-01-23`, and MCP service `https://sanrio-na.myshopify.com/api/ucp/mcp`. It declares catalog search and lookup capabilities. A bounded JSON-RPC `tools/list` POST returned HTTP 200 and listed `search_catalog`, `lookup_catalog` and `get_product`, alongside commerce tools that Sweetheart Finds does not need to invoke. Endpoint discovery alone does not establish successful merchandise access.

The observed search input schema is:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_catalog",
    "arguments": {
      "meta": {"ucp-agent": {"profile": "OWNER_HOSTED_PROFILE_URL"}},
      "catalog": {
        "query": "Usahana",
        "context": {"address_country": "US", "language": "en", "currency": "USD"},
        "filters": {"available": true},
        "pagination": {"limit": 5}
      }
    }
  }
}
```

The placeholder must be replaced with an authentic, publicly reachable application-owned profile. Lookup accepts 1–10 product/variant IDs. Prices use ISO 4217 minor currency units, requiring currency-aware conversion, including zero-decimal JPY. Availability and shipping eligibility are distinct signals.

### Actual acceptance tests

The application's authentic read-only catalog profile was published at `https://raw.githubusercontent.com/jordan61-dot/Sweetheart-Finds/main/public/ucp-agent.json` in owner-repository commit `2db90ee24d255f9e7e148e6b28e0ec9f71b59462`. Independent GET returned 200 with the expected JSON. One bounded unsigned Usahana search returned HTTP 401 and JSON-RPC `AuthenticationFailed`, with `HTTP signature error: signature_missing`. The planned My Melody request was skipped; no product offer was obtained.

Release engineering subsequently generated an application-owned P-256 key and published the public JWK in immutable profile `https://raw.githubusercontent.com/jordan61-dot/Sweetheart-Finds/4d41692636d057e872f740d7daa7fd7bac422af8/public/ucp-agent.json`. Locally verified RFC 9421 and Web Bot Auth-compatible signatures still produced remote `signature_missing`. Authentication interoperability remains unresolved. No further product requests were made after the stop instruction. Do not claim a functioning Sanrio UCP collector or retry undocumented signature variations. Private key material does not belong in this report or the public repository.

Official anonymous-tier descriptions do not override the actual merchant rejection. The warning against unauthenticated production traffic appears in the Global Catalog rate-limit discussion; do not conflate that product with this merchant endpoint.

Primary references:

- https://www.sanrio.com/.well-known/ucp
- https://shopify.dev/docs/agents/catalog/storefront-catalog
- https://shopify.dev/docs/agents/profiles
- https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting
- https://shopify.dev/ucp/agent-profiles/2026-08-25/valid-with-capabilities.json
- https://shopify.dev/docs/agents/get-started/profile

### Permission and retention boundary

Current Shopify catalog usage guidance permits shopper-facing discovery but restricts systematic harvesting into a standing product database/commerce index without Shopify or merchant consent, bulk export, redistribution and rehosting. Necessary catalog metadata/image caching is limited to 24 hours; price and availability caching to 15 minutes. Images must remain associated with the merchant listing, and merchant attribution parameters/links must be preserved. Therefore any future Sanrio UCP functionality should be bounded buyer-triggered temporary results, separate from the durable permitted catalog. Do not schedule bulk harvesting or place UCP product responses into durable catalog backups without the required consent.

- https://shopify.dev/docs/agents/catalog#usage-guidelines
- https://www.shopify.com/legal/api-terms (October 7, 2026 update)

### Signature implementation notes

Shopify documents an ECDSA P-256 Signed tier without an API key. Generate an authentic application key; publish only its public JWK in root `keys` of the hosted profile and store the private key as a runtime secret. UCP uses RFC 9421 signatures and RFC 9530 SHA-256 body digests. ECDSA signature bytes are fixed 64-byte `r||s`, not DER. MCP read-only catalog requests do not require an idempotency key merely because the transport uses POST. The default signed components include `@method`, `@authority`, `@path`, `content-digest`, `content-type` and `ucp-agent`; use the versioned specification rather than guessed headers. UCP signature parameters omit `alg`.

For Web Bot Auth, the documented Signature-Agent form is `sig1="PROFILE_URL";type=jwks_uri`; the signature component is `"signature-agent";key="sig1"`, which binds the extracted member value and parameters. Key IDs use the RFC 7638 thumbprint of the actual public JWK, matching its `kid`. The WBA signature uses created/expires/nonce and `tag="web-bot-auth"`. This describes an implemented, locally verified request form, not successful Sanrio authentication.

- https://ucp.dev/2026-08-25/specification/signatures/
- https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting
- https://www.shopify.com/ucp/2026-08

### Response normalization foundation

The official catalog example documents `result.structuredContent` containing `ucp`, `products` and `pagination`. Product fields include `id`, `title`, `handle`, `url`, description, categories, minor-unit `price_range`, media, options and variants. Variant fields include `id`, `sku`, `title`, `price: {amount,currency}`, `availability: {available}`, options and tags. Pagination includes `cursor`, `has_next_page` and `total_count`. Lookup can identify matched inputs and seller links. These are documentation/schema findings, not real merchandise collected from the blocked service. Never infer stock from product presence or a nonzero price. Render descriptions as plain text and retain merchant attribution links.

## Other merchant UCP discovery

Bounded GETs confirmed the following advertised catalog endpoints. These are discovery successes, not successful product searches or independent permanent-data licenses.

| Merchant profile | Status/version | Advertised MCP service | Actual product-call status |
| --- | --- | --- | --- |
| https://shop.mattel.com/.well-known/ucp | 200 / 2026-08-25 | https://prod-mattel.myshopify.com/api/ucp/mcp | Not tested |
| https://www.japanla.com/.well-known/ucp | 200 / 2026-08-25 | https://japan-la.myshopify.com/api/ucp/mcp | One authentic-profile unsigned My Melody search returned 401 signature_missing |
| https://www.blippo.com/.well-known/ucp | 200 / 2026-08-25 | https://blippo-4553.myshopify.com/api/ucp/mcp | Not tested |
| https://www.toynk.com/.well-known/ucp | 200 / 2026-08-25 | https://toynk-2.myshopify.com/api/ucp/mcp | Not tested |
| https://www.shopjustice.com/.well-known/ucp | 503 | Not established | Not tested |

The successful profiles declare `dev.ucp.shopping.catalog.search`, `dev.ucp.shopping.catalog.lookup` and the Shopify storefront catalog extension. Their Shopify store handles were obtained from the actual profiles, not guessed. Do not classify untested merchants as authentication-blocked or working collectors.

## Marketplace/API assessment

| Source | Current primary-source access findings | Implementation boundary |
| --- | --- | --- |
| eBay | Browse search/lookup needs application OAuth. Production Buy API access requires eligibility review/EPN process/contracts; approval is not guaranteed. Default Browse allowance is 5,000 calls/day for methods other than getItems. | Credential/approval-gated official adapter; external search alternatives. No substitute marketplace scraping. |
| Etsy | Official v3 API requires registered application credentials and approved access. Current docs distinguish reviewed Personal Apps, seller-only access and Commercial access. Screen scraping is prohibited. | Keep inactive without valid credentials and approved use; honor app-specific QPS/QPD, caching and attribution. |
| Bonanza | Official resale search/lookup API with prices, status and shipping. Application approval is required, usually 1–2 business days per guide. `findItemsByKeywords` uses form-encoded JSON and `X-BONANZLE-API-DEV-NAME`. | Promising after owner application approval; never fabricate a developer name. Check actual quota/retention before activation. |
| Rakuten Ichiba | Official free Web Service search, current version 2026-07-01. Requires app ID and accessKey, unlike obsolete examples. Registration records site/use/QPS; branding required. | Strong Japanese source once authentic approved credentials exist. Retain JPY and unknown US delivery unless supplied. |
| Mercari US | Prohibits non-provided automated access/extraction. No approved public buyer-search API established here. | External searches unless suitable authorization is granted. |
| Poshmark | Terms restrict scraping/automated collection. No authorized general buyer-search integration established. | External searches. |
| Depop | Private partner Selling API supports inventory/order integrations; unauthorized automation/internal API access restricted. | Seller API is not a public shopping-search entitlement; external searches. |
| Facebook Marketplace | No approved general public product-search API established in this assessment. | Ordinary external discovery/navigation; no authenticated scraping. |

Primary references:

- https://developer.ebay.com/api-docs/buy/buy-requirements.html
- https://developer.ebay.com/develop/api/buy/browse_api
- https://developer.ebay.com/develop/api/buy/api_call_limits
- https://developers.etsy.com/documentation/
- https://developers.etsy.com/documentation/essentials/rate-limits/
- https://api.bonanza.com/docs/reference/find_items_by_keywords
- https://api.bonanza.com/docs/getting_started/quick_start_guide
- https://api.bonanza.com/accounts/new
- https://webservice.rakuten.co.jp/documentation/ichiba-item-search
- https://webservice.rakuten.co.jp/guide
- https://webservice.faq.rakuten.net/hc/en-us/articles/900001971983-Are-Rakuten-Webservice-APIs-free-to-use
- https://www.mercari.com/us/help_center/topics/listing/policies/prohibited-conduct/
- https://poshmark.com/terms
- https://partnerapi.depop.com/api-docs/
- https://partnerapi.depop.com/api-docs/terms/

Rakuten endpoint: `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701`. Bonanza endpoint: `https://api.bonanza.com/api_requests/standard_request`. Neither was called using invented, borrowed or documentation-example credentials.

## Mandarake RSS

Official page https://www.mandarake.co.jp/information/rss/ invites subscriptions to mail-order arrival feeds. However, bounded GETs to `https://order.mandarake.co.jp/rss/` and official `?shop=1` redirected to the main HTML homepage with HTTP 200 rather than RSS. Independent search retrieval saw the same redirect. No actual feed product fields, prices, stock or image rights were established. Keep inactive with a redirect/content-type diagnostic, ordinary shopping links and a publisher-permission follow-up. RSS publication alone is not permission to rehost photos or maintain a bulk commerce database; do not parse homepage HTML as a successful feed.

## Bounded factual source review: 23 offers

`data/stage2-reviewed.json` contains 23 individually reviewed merchandise records and 23 offers from six primary storefronts. Original observations were November 7, 2026, 18:09–18:20 UTC. These are manual source observations, not an operational unattended retailer API. Each retains its exact source link, original title, original currency/price, observation timestamp, source identifier and availability evidence. No images, copied descriptions, personal data or raw HTML snapshots are included. Freshness must be calculated from those unchanged original timestamps.

| Primary source | Positive offers | Evidence and limitations |
| --- | ---: | --- |
| ToyWiz | 11 | Fresh HTTP 200 pages, positive prices, Product JSON-LD InStock, visible stock/purchase controls. New only where NewCondition supplied. Retailer New York address supports seller region. Requests respected published 10-second crawl delay. |
| Toynk | 1 | Crumbs Sugar Cookie toddler 2–4T costume, fresh InStock metadata. Condition Unknown. Documented free contiguous-US shipping retains Alaska/Hawaii exception; no worldwide shipping assumption. |
| Sanrio Japan | 8 | Two each for Usahana, My Melody, Pompompurin, Hello Kitty. Fresh official Product InStock offers/purchase controls. JPY retained; US delivery and manufacturing country unknown. |
| Narumiya Online | 1 | Official Mezzo Piano rabbit clear pouch, 990 JPY, fresh InStock Product offer. No independent checkout interaction established from server-rendered page; US shipping unknown. |
| Super Monkey | 1 | Actual Crumbs Sugar Cookie large doll, source model MGA-576884, 17.95 KWD, fresh InStock Product metadata and visible stock/purchase controls. Seller region and US shipping unknown. |
| Walmart | 1 | Justice Girls Skate Court Sneakers, selected Leopard / 4 Big Girl, 21 USD. Fresh page Add to cart; follow-up confirmed USD, InStock markup and Walmart.com seller. Delivery destination-dependent/unknown. |

| Interest | Reviewed offers |
| --- | ---: |
| Littlest Pet Shop | 2 |
| My Little Pony | 2 |
| Shopkins | 3 |
| Num Noms | 2 |
| Crumbs Sugar Cookie | 2 |
| Lalaloopsy | 2 |
| Monster High | 2 |
| Sanrio | 8 |
| Pompompurin | 2 |
| Hello Kitty | 2 |
| My Melody | 2 |
| Usahana | 2 |
| Mezzo Piano | 1 |
| Justice Girls | 1 |

Category totals intentionally overlap for parent/character associations and must not be summed as unique products. Crumbs/Lalaloopsy includes an actual doll and a separate costume. Pompompurin S/M are separate sizes. LPS damaged packaging and unknown/random mystery-pack contents are retained. No unsupported rarity, vintage, licensing, manufacturing country or release-year claim was added. Conditions remain Unknown unless NewCondition was actually supplied. Source region indicates retail market, not manufacture.

Before workspace loss, all 23 records passed `productSchema` and `normalizeProduct`, with 23 distinct IDs/URLs, positive prices and zero images. The reconstructed file was independently revalidated against the restored application modules: all 23 passed both schema validation and normalization, with the same counts and uniqueness. This does not claim production ingestion or destination checkout success.

### Fresh bounded verification after recovery

One additional source-page verification batch ran on November 7, 2026, from 22:36:12 through 22:38:44 UTC (request timestamps). It used one request per listed product, sequential ToyWiz requests with at least 10 seconds between responses, bounded response sizes/timeouts, and no retries or bypass attempts. Twenty-two pages returned source-confirmed positive-price `InStock` offers, with unchanged currencies and asking prices. The Narumiya offer is supported by Product structured metadata; a server-rendered checkout control remains unverified. Walmart supplied the current USD price, `InStock` markup, purchase control and Walmart.com seller. No checkout was submitted.

Only those 22 genuinely refreshed observations received new `observedAt` timestamps. Their original observation timestamps remain in `collector.previousObservationAt`; previous HTTP dates are preserved where recoverable. The ToyWiz Starshine plush request failed with `Tunnel connection failed: 403 Forbidden`. Its old 18:16 observation was preserved without renewal and must be treated as stale under ToyWiz's freshness policy; the attempt/error is recorded separately. This network failure is not evidence that the product sold out, nor proof of a specific merchant-side cause. The other My Little Pony offer refreshed successfully, so every interest retains at least one fresh source-observed offer in this batch. Counts: 22 fresh positives, zero newly confirmed unavailable, one failed verification, zero price changes, zero copied images.

Fresh primary reads corrected stale search evidence: Toynk Num Noms was sold out despite a cached available result; a ToyWiz Num Noms cereal pack and three Lalaloopsy doll/playset pages were unavailable. Some unavailable offers had a zero metadata price and were excluded rather than presented as free. Shopkins Season 11 fresh asking price was 11.99 USD rather than an older search price. An apparent Crumbs doll search result was actually an accessory and was excluded. Search snippets alone never determined imported prices or stock.

## Boundaries and next actions

This bounded editorial factual review does not grant recurring scraping, systematic bulk harvesting or product-image rights. No automated retailer integration is enabled by the review. APIs requiring approvals remain inactive until authentic credentials and suitable approved use exist. Generic robots allowance or an accessible JSON endpoint is not a standalone redistribution/image license. No paid proxy, trial, billing account, authentication bypass or anti-bot evasion was used. Stage 2 must report manual observations separately from successful automated collectors, and endpoint discovery separately from actual merchandise responses.
