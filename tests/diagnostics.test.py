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


wild_spec = importlib.util.spec_from_file_location(
    'wildmart_runner', Path(__file__).resolve().parents[1] / 'scripts/collect_wildmart.py')
wild = importlib.util.module_from_spec(wild_spec)
wild_spec.loader.exec_module(wild)


class WildmartCollection(unittest.TestCase):
    def test_interests_in_variant_titles_and_aliases_reach_the_normalizer(self):
        self.assertTrue(wild.is_candidate({'title':'Assorted toys','variants':[{'title':'Shoppies doll'}]}))
        for title in ['LPS pets', 'Skullector doll', 'マイリトルポニー', 'U*SA*HA*NA tote', 'Limited Too Justice girls']:
            self.assertTrue(wild.is_candidate({'title':title,'variants':[]}), title)
        self.assertFalse(wild.is_candidate({'title':'Alps landscape','variants':[]}))

    def run_detail(self, error=None, verified=1):
        from unittest.mock import patch
        import contextlib
        calls = []
        def service(payload):
            action = payload.get('action','maintenance')
            calls.append(action)
            if action == 'acp-state': return {'due':False}
            if action == 'acp-refresh-plan': return {'ids':['1','2']}
            if action == 'refresh-acp': return {'attempted':len(payload['results']),'verified':verified}
            return {'merchantPhotos':{'checked':0},'errors':[]}
        with patch.object(wild,'call',side_effect=service), patch.object(wild,'get',side_effect=error,return_value={'item':{}}) as fetch, patch.object(wild.time,'sleep'), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            try:
                wild.main()
                reason = None
            except SystemExit as e:
                reason = str(e)
        return reason, calls, fetch.call_count

    def test_missing_manifest_records_backoff_and_skips_detail_refresh(self):
        from unittest.mock import patch
        from urllib.error import HTTPError
        missing = HTTPError(wild.MANIFEST,404,'Not Found',{},None)
        with patch.object(wild,'get',side_effect=missing) as fetch, patch.object(
            wild,'call',side_effect=[{'due':True,'lastSuccess':'old'},{'failed':True,'nextAt':'later'}]
        ) as service, patch.object(wild,'report_deferral') as warn:
            wild.main()
        fetch.assert_called_once_with(wild.MANIFEST)
        self.assertEqual(service.call_args.args[0], {'action':'acp-failure',
            'message':'Wildmart ACP manifest returned HTTP 404','expectedLastSuccess':'old'})
        warn.assert_called_once_with('Wildmart ACP manifest returned HTTP 404','later')

    def test_confirmed_manifest_outage_waits_without_contacting_merchant(self):
        from unittest.mock import patch
        reason = 'Wildmart ACP manifest returned HTTP 410'
        with patch.object(wild,'get') as fetch, patch.object(wild,'call',return_value={
            'due':False,'failures':1,'error':reason,'nextAt':'later'
        }) as service, patch.object(wild,'report_deferral') as warn:
            wild.main()
        fetch.assert_not_called()
        service.assert_called_once_with({'action':'acp-state'})
        warn.assert_called_once_with(reason,'later')

    def test_unrecorded_outage_is_a_job_failure(self):
        from unittest.mock import patch
        with patch.object(wild,'collect',side_effect=wild.ManifestUnavailable('missing')), patch.object(
            wild,'call',side_effect=[{'due':True},{}]
        ), self.assertRaises(RuntimeError):
            wild.main()

    def test_complete_detail_outage_is_visible_after_maintenance(self):
        reason, calls, count = self.run_detail(error=TimeoutError(),verified=0)
        self.assertIsNotNone(reason)
        self.assertEqual(calls[-1], 'maintenance')
        self.assertEqual(count,2)

    def test_throttling_stops_requests_and_preserves_independent_maintenance(self):
        from urllib.error import HTTPError
        reason,calls,count = self.run_detail(error=HTTPError('https://example.com/',429,'throttled',{},None),verified=0)
        self.assertIsNotNone(reason)
        self.assertEqual(count,1)
        self.assertEqual(calls[-1], 'maintenance')

    def test_partial_detail_refresh_is_reported(self):
        reason,calls,count = self.run_detail(verified=1)
        self.assertIsNotNone(reason)
        self.assertEqual(calls[-1],'maintenance')
        self.assertEqual(count,2)

    def test_complete_detail_refresh_succeeds(self):
        self.assertIsNone(self.run_detail(verified=2)[0])


if __name__=='__main__':unittest.main()
