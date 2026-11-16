# eBay production account-deletion subscription

Sweetheart Finds uses the subscription path because its planned integration persists permitted listing data. No eBay account or seller identifiers are currently stored. The callback verifies incoming account-deletion events, acknowledges them without storing their payloads, and does not modify catalog or personal data. Before introducing any eBay user-linked storage, implement and test removal from every location where it can be retained, including backups.

## Runtime configuration

Configure these in the existing Site's server-side environment and redeploy to apply new values.

| Name | Value |
| --- | --- |
| EBAY_DELETION_VERIFICATION_TOKEN | A randomly generated token of 32–80 letters, digits, hyphens or underscores. Enter the identical value in the developer portal. |
| EBAY_APP_ID | The Sweetheart Finds production App ID. Needed for notification signature verification. |
| EBAY_CERT_ID | The newly rotated production Cert ID. Set as a runtime secret. |

The callback URL is `https://sweetheart-finds.jordanmullens12.chatgpt.site/api/ebay/account-deletion`. Enter it exactly, without a trailing slash. The challenge hash includes that exact URL. The app uses the production credentials to fetch and cache eBay public keys for signed POSTs. Challenge verification does not require an enabled keyset.

## Portal verification

1. In the eBay Developers Program, open Application Keys → Production → Sweetheart Finds → Alerts and Notifications. Select Marketplace Account Deletion and enter the alert email, callback URL and matching verification token. Save and confirm eBay accepts the HTTPS challenge.
2. Confirm the production keyset is enabled. Rotate the previously exposed Cert ID and configure the replacement as a runtime secret. Credentials must never be stored in the repository or sent in support correspondence.
3. Select **Send Test Notification** and confirm success. The endpoint rejects missing or invalid signatures and reports transient errors if the eBay token or key lookup is unavailable.
4. Verify Curated Item Feed approval separately before enabling any production feed import.

[eBay enrollment guide](https://developer.ebay.com/develop/guides/buy/marketplace-user-account-deletion)
