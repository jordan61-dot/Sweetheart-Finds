# Participating retailer integration

This format requires no paid software or external integration account. The retailer hosts an HTTPS JSON or CSV export on infrastructure it already controls. Hosting a public file does not by itself grant redistribution permission.

Obtain written permission covering recurring retrieval, durable product/price/stock indexing, retention, permissible refresh frequency, and separately the specified images. Retain a public evidence URL or a non-sensitive statement referencing a privately retained agreement. Record an expiry/review deadline. Do not use this durable pipeline for Shopify Catalog temporary shopper results.

## Configuration

Set `FEED_ALLOWED_HOSTS` to exact comma-separated merchant hostnames and `FEED_IMAGE_ALLOWED_HOSTS` to exact image hostnames using Sites server environment configuration. Never include wildcards or an untrusted proxy. Register the following structure in Catalog Studio → Sources & collection → Register an authorized retailer feed, replacing every example value with approved real information:

```json
{
  "id": "merchant-name",
  "name": "Merchant name",
  "url": "https://merchant.example/catalog.json",
  "format": "json",
  "enabled": true,
  "intervalHours": 24,
  "permissionUrl": "https://merchant.example/integration-permission",
  "permissionNote": "Describe the actual recurring retrieval, durable retention and photograph permission granted by this merchant.",
  "permissionExpiresAt": "2027-01-01T00:00:00Z",
  "recurringAllowed": true,
  "durableAllowed": true,
  "imagesAllowed": true,
  "imageHosts": ["images.merchant.example"],
  "mapping": {}
}
```

All examples are fixtures, not operational sources. Disabled/expired permissions cannot collect. Source name and URL cannot change under an existing ID. Suspend the old feed and register a new identity for a different source.

## Product contract

```json
[
  {
    "sourceId": "merchant-product-123",
    "variantId": "pink-small",
    "title": "My Melody plush — pink, small",
    "categories": ["my-melody"],
    "brand": "Sanrio",
    "type": "Plush",
    "url": "https://merchant.example/products/123",
    "price": 19.99,
    "currency": "USD",
    "condition": "New",
    "availability": "available",
    "shippingEligibility": "unknown",
    "images": [
      {
        "url": "https://images.merchant.example/123-pink-small.jpg",
        "sourceId": "merchant-product-123",
        "variantId": "pink-small",
        "attribution": "Photograph supplied with permission by Merchant name"
      }
    ]
  }
]
```

Source product and variant IDs are mandatory identity evidence for automatic photographs. The first qualifying image is verified and considered for publication per product/page; additional galleries need review. An incorrect variant never inherits another variant's image. Missing price is null; currency must be explicitly supplied. Availability values: available, unavailable, ended, unknown. A feed omission is never interpreted as sold.

CSV supports the same simple fields, pipe-separated categories and explicit field mapping, e.g. `{"sourceId":"merchant_sku","url":"product_url"}`. Use JSON for nested identifiers and photographs. One export contains 1–250 records and at most 1.5 MB. Larger merchants should supply separate explicitly authorized exports. The collector commits ten records per page and resumes its snapshot; do not manually import every page.

## Scheduler activation and proof

1. Register a genuinely approved feed and run Update feed now. Confirm the records appear in public search and verify correct photos.
2. The fixed main-branch GitHub workflow authenticates with a short-lived GitHub OIDC token. No shared secret is required. The deployed verifier pins the immutable repository/owner IDs and exact workflow identity.
3. GitHub's `Collect permissioned merchant feeds` workflow calls POST `/api/automation/tick` with the signed short-lived identity token. It selects at most two due feeds; each retains its own interval and checkpoint. A fifteen-minute tick is not hourly retrieval for every source.
4. Inspect the actual Actions execution and Catalog Studio execution histories. An authentication failure means no work was authorized; a configured cron expression is not success. Confirm catalog counts, price observations, search results and a subsequent idempotent run.
5. Monitor overdue runs, source failures, image verification failures, and repository inactivity. Recover a failed/interrupted feed through the owner control after addressing its cause. Recovery does not reset daily request budgets.

A successful maintenance execution does not establish live merchandise harvesting; that still requires a real permitted feed. Rollback: suspend feeds, disable the workflow, and redeploy prior source. Do not restore an older database over newer personal records. The current backup tool preserves new config-backed feed/media state without a migration.
