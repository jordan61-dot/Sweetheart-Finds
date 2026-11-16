"""Offline validation for US eBay Curated Item Feed files. No network or publication."""
import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import gzip
import json
import re
from urllib.parse import urlsplit

REQUIRED = {
    "itemId", "marketplaceId", "categoryId", "title", "priceValue",
    "priceCurrency", "availability",
}
INTERESTS = re.compile(
    r"littlest\s+pet\s+shop|my\s+little\s+pony|shopkins|num\s*noms|"
    r"lalaloopsy|crumbs\s+sugar\s+cookie|monster\s+high|sanrio|"
    r"pompompurin|hello\s+kitty|my\s+melody|usahana|mezzo\s+piano|"
    r"justice\s+(?:girls|clothing)|ウサハナ|メゾピアノ|ハローキティ|マイメロディ|ポムポムプリン|サンリオ",
    re.IGNORECASE,
)
AVAILABILITY = {
    "AVAILABLE": "available",
    "UNAVAILABLE": "unavailable",
    "TEMPORARILY_UNAVAILABLE": "unavailable",
}


def utc(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.utcoffset() is None:
        raise ValueError("Timestamp must include a timezone")
    return result.astimezone(timezone.utc)


def remote_reference(value, domains):
    if not value or len(value) > 2000:
        return None
    try:
        url = urlsplit(value)
        if (url.scheme == "https" and url.username is None and url.password is None
                and url.hostname in domains and url.port in (443, None)):
            return value
    except ValueError:
        pass
    return None


def inspect_feed(stream, *, file_id, snapshot_at, observed_at, max_rows, max_offers):
    """Return expiring evidence for a single file. Feed omissions have no stock meaning."""
    reader = csv.DictReader(stream, delimiter="\t")
    if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
        raise ValueError("Required Curated Item Feed columns are absent")
    if len(reader.fieldnames) != len(set(reader.fieldnames)):
        raise ValueError("Duplicate feed columns")
    if snapshot_at > observed_at:
        raise ValueError("Snapshot timestamp is in the future")

    offers = {}
    for index, row in enumerate(reader, start=1):
        if index > max_rows:
            raise ValueError("Feed row budget exceeded")
        if None in row or any(row[field] is None for field in REQUIRED):
            raise ValueError("Invalid TSV row")
        title = row["title"].strip()
        if (row["marketplaceId"] != "EBAY_US" or not 0 < len(title) <= 400
                or not INTERESTS.search(title)):
            continue
        item_id = row["itemId"]
        if not re.fullmatch(r"v1\|[0-9]{1,20}\|[0-9]{1,20}", item_id):
            raise ValueError("Invalid REST item ID")
        if not re.fullmatch(r"[0-9]{1,12}", row["categoryId"]):
            raise ValueError("Invalid category ID")

        end_date = row.get("itemEndDate")
        end = utc(end_date) if end_date else None
        availability = AVAILABILITY.get(row["availability"], "unknown")
        if end is not None and end <= observed_at:
            availability = "ended"
        try:
            price = Decimal(row["priceValue"])
        except InvalidOperation as exc:
            raise ValueError("Invalid relevant listing price") from exc
        if not price.is_finite() or price < 0 or price > 100_000_000 or row["priceCurrency"] != "USD":
            raise ValueError("Invalid relevant listing price or currency")

        offer = {
            "id": "ebay:" + item_id.replace("|", ":"),
            "itemId": item_id,
            "marketplace": "EBAY_US",
            "categoryId": row["categoryId"],
            "title": title,
            "price": format(price, "f"),
            "currency": "USD",
            "availability": availability,
            "endsAt": end.isoformat() if end is not None else None,
            "sourceFileId": file_id,
            "snapshotAt": snapshot_at.isoformat(),
            "listingUrl": remote_reference(row.get("itemWebUrl"), {"www.ebay.com", "ebay.com"}),
            "affiliateUrl": remote_reference(row.get("itemAffiliateWebUrl"), {"www.ebay.com", "ebay.com"}),
            "listingImageCandidate": remote_reference(row.get("imageUrl"), {"i.ebayimg.com"}),
        }
        existing = offers.get(item_id)
        if existing is not None and existing != offer:
            raise ValueError("Conflicting duplicate eBay item ID in one file")
        offers[item_id] = offer
        if len(offers) > max_offers:
            raise ValueError("Relevant offer budget exceeded")
    return list(offers.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", help="An authorized local .tsv.gz file or a synthetic test file")
    parser.add_argument("--file-id", required=True)
    parser.add_argument("--snapshot-at", required=True)
    parser.add_argument("--max-rows", type=int, default=500_000)
    parser.add_argument("--max-offers", type=int, default=10_000)
    opts = parser.parse_args()
    csv.field_size_limit(16384)
    with gzip.open(opts.file, "rt", encoding="utf-8-sig", newline="") as stream:
        offers = inspect_feed(stream, file_id=opts.file_id, snapshot_at=utc(opts.snapshot_at),
                              observed_at=datetime.now(timezone.utc), max_rows=opts.max_rows,
                              max_offers=opts.max_offers)
    print(json.dumps({"mode": "offline-diagnostics", "count": len(offers)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
