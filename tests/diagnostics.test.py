import importlib.util,json,unittest,io
from pathlib import Path
spec=importlib.util.spec_from_file_location('diagnostics',Path(__file__).resolve().parents[1]/'scripts/check_source_profiles.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Opener:
 def __init__(self,data):self.data=data
 def open(self,*a,**k):return io.BytesIO(self.data)
class Diagnostics(unittest.TestCase):
 def test_valid_profile_does_not_claim_product_access(self):
  r=m.check('QA','https://example.com',Opener(json.dumps({'ucp':{'version':'1','capabilities':{}}}).encode()));self.assertEqual(r['status'],'profile-readable');self.assertFalse(r['productCollectorVerified'])
 def test_invalid_and_oversized_profiles_fail(self):
  for data in [b'bad',b'{}',b'x'*500001]:self.assertEqual(m.check('QA','https://example.com',Opener(data))['status'],'failed')
 def test_redirects_are_rejected(self):
  with self.assertRaises(ValueError):m.NoRedirect().redirect_request(None)
 def test_summary_is_honest(self):
  text=m.markdown({'results':[{'source':'QA','status':'failed','error':'denied|access'}]});self.assertIn('do not verify product access',text);self.assertIn('denied/access',text)
ebay_spec = importlib.util.spec_from_file_location(
    'ebay_curated', Path(__file__).resolve().parents[1] / 'scripts/collectors/ebay_curated.py'
)
ebay = importlib.util.module_from_spec(ebay_spec)
ebay_spec.loader.exec_module(ebay)


class EbayFeedDiagnostics(unittest.TestCase):
    def test_link_must_point_to_expected_item_and_variation(self):
        item = 'v1|123|456'
        exact = 'https://www.ebay.com/itm/toy/123?var=456&campid=10'
        self.assertEqual(ebay.listing_reference(exact, item), exact)
        for link in (
            'https://www.ebay.com/itm/124',
            'https://www.ebay.com/itm/123?var=457',
            'https://www.ebay.com/itm/123?var=456&var=457',
            'https://www.ebay.com/sch/i.html?_nkw=123',
            'https://www.ebay.com.example/itm/123',
        ):
            self.assertIsNone(ebay.listing_reference(link, item))

    def test_omitted_end_date_and_duplicate_variations(self):
        stream = io.StringIO(
            'itemId\tmarketplaceId\tcategoryId\ttitle\tpriceValue\tpriceCurrency\tavailability\n'
            'v1|123|456\tEBAY_US\t220\tMonster High Doll\t20.00\tUSD\tAVAILABLE\n'
            'v1|123|457\tEBAY_US\t220\tMonster High Doll\t19.00\tUSD\tUNAVAILABLE\n'
            'v1|123|456\tEBAY_US\t220\tMonster High Doll\t20.00\tUSD\tAVAILABLE\n'
        )
        at = ebay.utc('2026-11-16T00:00:00Z')
        result = ebay.inspect_feed(stream, file_id='fixture', snapshot_at=at, observed_at=at,
                                   max_rows=5, max_offers=5)
        self.assertEqual([row['id'] for row in result], ['ebay:v1:123:456', 'ebay:v1:123:457'])
        self.assertEqual([row['availability'] for row in result], ['available', 'unavailable'])
        self.assertTrue(all(row['endsAt'] is None for row in result))


if __name__=='__main__':unittest.main()
