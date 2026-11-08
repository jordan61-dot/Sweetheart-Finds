"""Bounded discovery-profile diagnostics; never calls a product API or writes catalog data."""
import argparse,datetime,json,time,urllib.request
SOURCES={'Sanrio':'https://www.sanrio.com/.well-known/ucp','Mattel':'https://shop.mattel.com/.well-known/ucp','JapanLA':'https://www.japanla.com/.well-known/ucp','Blippo':'https://www.blippo.com/.well-known/ucp','Toynk':'https://www.toynk.com/.well-known/ucp'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise ValueError('Profile redirect rejected; review publisher configuration')
def check(name,url,opener=None):
 start=time.monotonic();opener=opener or urllib.request.build_opener(NoRedirect())
 try:
  request=urllib.request.Request(url,headers={'User-Agent':'SweetheartFinds/2.0 (read-only discovery-profile diagnostic; https://github.com/jordan61-dot/Sweetheart-Finds)'})
  with opener.open(request,timeout=15) as response:
   b=response.read(500001)
   if len(b)>500000:raise ValueError('Profile too large')
   d=json.loads(b)
  ucp=d.get('ucp',{})
  if not isinstance(ucp,dict) or not isinstance(ucp.get('version'),str) or not isinstance(ucp.get('capabilities'),dict):raise ValueError('Malformed UCP profile')
  return {'source':name,'status':'profile-readable','version':ucp['version'],'seconds':round(time.monotonic()-start,2),'productCollectorVerified':False}
 except Exception as e:return {'source':name,'status':'failed','error':str(e)[:300],'productCollectorVerified':False}
def markdown(report):
 rows=['## Source profile diagnostics','','These checks read discovery profiles only. They do not verify product access or collect merchandise.','','| Source | Result | Details |','| --- | --- | --- |']
 for r in report['results']:
  detail=str(r.get('version') or r.get('error','')).replace('|','/').replace('\n',' ')
  rows.append('| '+r['source']+' | '+r['status']+' | '+detail+' |')
 return '\n'.join(rows)+'\n'
def main():
 p=argparse.ArgumentParser();p.add_argument('--summary');a=p.parse_args();results=[]
 for n,(name,url) in enumerate(SOURCES.items()):
  if n:time.sleep(2)
  results.append(check(name,url))
 report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'profile diagnostics only; no product harvesting','results':results};print(json.dumps(report,indent=2))
 if a.summary:
  with open(a.summary,'a') as out:out.write(markdown(report))
 return 1 if any(r['status']=='failed' for r in results) else 0
if __name__=='__main__':raise SystemExit(main())
