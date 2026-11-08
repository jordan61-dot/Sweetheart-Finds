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
if __name__=='__main__':unittest.main()
