"""Non-mutating independent HTTP checks. python tests/production-smoke.py [origin]"""
import json,sys,urllib.request,urllib.error,time
base=sys.argv[1] if len(sys.argv)>1 else 'https://sweetheart-finds.jordanmullens12.chatgpt.site'
def get(path):
 t=time.monotonic()
 try:
  with urllib.request.urlopen(base+path,timeout=30) as r:return r.status,r.read().decode(),round(time.monotonic()-t,3)
 except urllib.error.HTTPError as e:return e.code,e.read().decode(),round(time.monotonic()-t,3)
checks=[]
for path in ['/','/category/usahana','/product/ref-cc4d1f43bf0330c0','/api/catalog?q=usahana','/api/catalog?type=Books','/api/personal','/api/admin']:
 code,body,seconds=get(path); expected=401 if path in ['/api/personal','/api/admin'] else 200
 assert code==expected,(path,code,body[:100]);checks.append({'path':path,'status':code,'seconds':seconds})
print(json.dumps(checks,indent=2))
