"""Bounded, factual metadata ingestion. No copyrighted descriptions or images copied.
Recheck source policies before enabling recurring collection. At least 3 seconds
between requests; never query endpoints, accounts, carts, checkout, or bypasses.
"""
import urllib.request, urllib.robotparser, urllib.parse, json, re, time, hashlib, datetime, html
from pathlib import Path
ROOT=Path.cwd()/"outputs"
ROOT.mkdir(parents=True,exist_ok=True)
UA='SweetheartFinds/0.1 (AI-agent; read-only personal merchandise discovery)'
PATHS=[
('littlest-pet-shop','littlest-pet-shop-pet-surprise'),
('littlest-pet-shop','littlest-pet-shop-petfluencers-assortment'),
('littlest-pet-shop','littlest-pet-shop-safari-play-pack'),
('littlest-pet-shop','littlest-pet-shop-cuddle-plush-pet'),
('littlest-pet-shop','littlest-pet-shop-diner-dash-play-pack'),
('littlest-pet-shop','littlest-pet-shop-grooming-spa-play-pack'),
('littlest-pet-shop','littlest-pet-shop-pet-pairs-series-2'),
('littlest-pet-shop','littlest-pet-shop-pet-trio-series-2'),
('my-little-pony','mashems-my-little-pony'),
('my-little-pony','my-little-pony-40th-anniversary-original-pony'),
('my-little-pony','my-little-pony-surprise-figures')]
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/json'})
 with urllib.request.urlopen(req,timeout=25) as r:
  if r.status!=200: raise ValueError('source returned '+str(r.status))
  data=r.read(2_000_001)
  if len(data)>2_000_000:raise ValueError('Source response exceeds2MB')
  return data.decode()
def walk(obj):
 if isinstance(obj,dict):
  yield obj
  for v in obj.values(): yield from walk(v)
 elif isinstance(obj,list):
  for v in obj:yield from walk(v)
def collect():
 robot=urllib.robotparser.RobotFileParser();text=fetch('https://schylling.com/robots.txt');robot.parse(text.splitlines()); delay=max(3,robot.crawl_delay('*') or 3)
 records=[]; errors=[]
 for cat,slug in PATHS:
  url='https://schylling.com/product/'+slug+'/'
  if not robot.can_fetch(UA,url): errors.append({'url':url,'error':'robots disallows'});continue
  time.sleep(delay)
  try:
   raw=fetch(url); nodes=[]
   for s in re.findall(r'<script[^>]*type=[\"\x27]application/ld\+json[\"\x27][^>]*>(.*?)</script>',raw,re.S):
    try:nodes.extend(walk(json.loads(s)))
    except json.JSONDecodeError:pass
   ps=[p for p in nodes if p.get('@type')=='Product'];p=next((x for x in ps if x.get('url','').rstrip('/')==url.rstrip('/')),ps[0] if ps else None)
   if not p:raise ValueError('no Product JSON-LD')
   offers=p.get('offers',[]);offers=offers if isinstance(offers,list) else [offers];off=offers[0] if offers else {}
   paused='short pause on new orders' in raw
   av=off.get('availability','').split('/')[-1]
   # Availability is overridden by an explicit sitewide order pause.
   av=('unavailable' if paused else 'available' if av=='InStock' else 'unavailable' if av=='OutOfStock' else 'unknown')
   ts=datetime.datetime.now(datetime.timezone.utc).isoformat()
   name=html.unescape(p.get('name','')).strip()
   records.append({'id':'schylling-'+str(p.get('sku') or hashlib.sha256(url.encode()).hexdigest()[:12]),'title':name,'categories':[cat],'brand':p.get('brand',{}).get('name',''),'type':'Plush toys' if 'plush' in name.lower() else 'Playsets' if 'play pack' in name.lower() else 'Figures','source':'Schylling','sourceUrl':url,'sourceId':str(p.get('sku','')),'recordStatus':'recently-observed','verifiedAt':ts,'identificationConfidence':'high','price':float(off['price']) if off.get('price') else None,'currency':off.get('priceCurrency') or None,'availability':av,'availabilityNote':'Retailer has paused new orders; a cart control or structured InStock flag does not establish a purchasable listing.' if paused else None,'condition':'unknown','shipping':None,'images':[],'imageRights':'not-established; source artwork deliberately omitted','description':'Official distributor record. Check the source for the current product selection and order status.','collector':{'sku':str(p.get('sku',''))},'provenance':{'method':'public Product JSON-LD; only factual identifiers and offer observations retained','robotsUrl':'https://schylling.com/robots.txt','crawlDelaySeconds':delay,'termsReview':'No separate general terms link found in current public footer; recheck policies before recurring ingestion.','sourceContentHash':hashlib.sha256(raw.encode()).hexdigest()}})
   print(name,av,off.get('price'),off.get('priceCurrency'),flush=True)
  except Exception as e: errors.append({'url':url,'error':str(e)});print('ERROR',url,str(e),flush=True)
 for r in records:
  if r['sourceId']=='35335':
   r['price']=None;r['currency']=None;r['priceNote']='Known source currency conflict; price withheld pending source correction.'
 out={'schemaVersion':1,'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'records':records,'errors':errors};(ROOT/'schylling-products.json').write_text(json.dumps(out,indent=2,ensure_ascii=False));return out
if __name__=='__main__':collect()
