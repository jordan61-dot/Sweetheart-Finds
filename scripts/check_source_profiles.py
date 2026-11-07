import urllib.request,json,time,datetime
sources={'Sanrio':'https://www.sanrio.com/.well-known/ucp','Mattel':'https://shop.mattel.com/.well-known/ucp','JapanLA':'https://www.japanla.com/.well-known/ucp','Blippo':'https://www.blippo.com/.well-known/ucp','Toynk':'https://www.toynk.com/.well-known/ucp'};results=[]
for name,url in sources.items():
 start=time.monotonic()
 try:
  request=urllib.request.Request(url,headers={'User-Agent':'SweetheartFinds/2.0 (read-only discovery-profile diagnostic; https://github.com/jordan61-dot/Sweetheart-Finds)'})
  with urllib.request.urlopen(request,timeout=15) as response:
   b=response.read(500001)
   if len(b)>500000:raise ValueError('Profile too large')
   d=json.loads(b)
  results.append({'source':name,'status':'profile-readable','version':d.get('ucp',{}).get('version'),'seconds':round(time.monotonic()-start,2),'productCollectorVerified':False})
 except Exception as e:results.append({'source':name,'status':'failed','error':str(e)[:300],'productCollectorVerified':False})
 time.sleep(2)
print(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'profile diagnostics only; no product harvesting','results':results},indent=2))
