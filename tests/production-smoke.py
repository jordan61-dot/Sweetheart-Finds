"""Non-mutating independent HTTP checks. python tests/production-smoke.py [origin]"""
import json,sys,subprocess,time
base=sys.argv[1] if len(sys.argv)>1 else 'https://sweetheart-finds.jordanmullens12.chatgpt.site'
def get(path):
 t=time.monotonic()
 r=subprocess.run(['curl','--max-time','30','-sS','-w','\n%{http_code}',base+path],capture_output=True,text=True,check=True)
 body,code=r.stdout.rsplit('\n',1);return int(code),body,round(time.monotonic()-t,3)

checks=[]
for path in ['/','/category/usahana','/product/ref-cc4d1f43bf0330c0','/api/catalog?q=usahana','/api/catalog?type=Books','/api/personal','/api/admin']:
 code,body,seconds=get(path); expected=401 if path in ['/api/personal','/api/admin'] else 200
 assert code==expected,(path,code,body[:100]);checks.append({'path':path,'status':code,'seconds':seconds})
print(json.dumps(checks,indent=2))
for category in ['littlest-pet-shop','my-little-pony','shopkins','num-noms','crumbs-sugar-cookie','lalaloopsy','monster-high','sanrio','pompompurin','hello-kitty','my-melody','usahana','mezzo-piano','justice-girls']:
 code,body,seconds=get('/api/catalog?category='+category);assert code==200;data=json.loads(body);assert data['total']>0;assert all(category in p['categories'] for p in data['products']);print(category,data['total'])
code,body,_=get('/api/catalog?type=Books&sort=alpha');data=json.loads(body);assert all(p['type']=='Books' for p in data['products']);titles=[p['title'].lower() for p in data['products']];assert titles==sorted(titles)
code,body,_=get('/api/catalog?q=pompompurrin');data=json.loads(body);assert data['total']>=3;assert all('pompompurin' in p['categories'] for p in data['products'])
