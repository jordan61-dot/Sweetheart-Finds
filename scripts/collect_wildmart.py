"""Official ACP snapshot consumer. No storefront scraping, image downloads or disk cache."""
import hashlib,json,os,re,sys,time,urllib.request,urllib.parse
MANIFEST='https://wildmart.md/acp/feeds/index.json'
ENDPOINT='https://sweetheart-finds.jordanmullens12.chatgpt.site/api/automation/tick'
UA='SweetheartFinds/2.3 (+https://github.com/jordan61-dot/Sweetheart-Finds)'
# Broad prefilter only; the production normalizer applies all 14 taxonomies.
RELEVANT = re.compile(
    r'\b(?:lps|mlp|purin)\b|littlest[\W_]*pet[\W_]*shop|my[\W_]*little[\W_]*pony|'
    r'shopkins|shoppies|happy[\W_]*places|real[\W_]*littles|num[\W_]*noms?|lala[\W_]*loopsy|'
    r'crumbs[\W_]*sugar|monster[\W_]*high|skullector|creepreproduction|sanrio|'
    r'pom[\W_]*pom[\W_]*purin|hello[\W_]*kitty|my[\W_]*melody|u[\W_]*sa[\W_]*ha[\W_]*na|'
    r'mezzo[\W_]*piano|justice|limited[\W_]*too|just[\W_]*for[\W_]*girls|'
    r'マイリトルポニー|ナムノム|モンスターハイ|ウサハナ|うさはな|メゾ\s*ピアノ|ベリエちゃん|'
    r'ハローキティ|キティちゃん|マイメロ|ポムポムプリン|サンリオ', re.I)

def is_candidate(product):
    return bool(RELEVANT.search(product.get('title', ''))) or any(
        RELEVANT.search(variant.get('title') or '') for variant in product.get('variants', [])
    )

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(NoRedirect)
def get(url,limit=65536):
 with opener.open(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=30) as r:
  data=r.read(limit+1)
  if len(data)>limit: raise ValueError('Response exceeds limit')
  return json.loads(data)
def feed_url(url):
 if not re.fullmatch(r'https://wildmart\.md/acp/feeds/[a-zA-Z0-9-]+/ro/(metadata\.json|products\.jsonl)',url):raise ValueError('Unapproved feed URL')
 return url
def collect():
 start=time.monotonic();m=get(MANIFEST)
 if m.get('publication_mode')!='offline_full_replacement':raise ValueError('Feed contract changed')
 f=next(x for x in m['feeds'] if x['locale']=='ro-MD')
 if not 0<f['bytes']<=350_000_000 or not 0<f['product_count']<=200000:raise ValueError('Feed resource budget exceeded')
 metadata=get(feed_url(f['metadata_url']))
 digest=hashlib.sha256();rows=[];count=0;size=0
 with opener.open(urllib.request.Request(feed_url(f['products_url']),headers={'User-Agent':UA,'Accept-Encoding':'identity'}),timeout=30) as r:
  while True:
   line=r.readline(131073)
   if not line:break
   size+=len(line);digest.update(line)
   if len(line)>131072 or size>350_000_000 or time.monotonic()-start>240:raise ValueError('Stream budget exceeded')
   p=json.loads(line);count+=1
   if is_candidate(p):
    # Omit descriptions and unrelated fields; retain exact source identities.
    rows.append({k:p[k] for k in ['id','title','url','variants','media'] if k in p})
    if len(rows)>1500:raise ValueError('Relevant catalog exceeds safe import limit')
 if size!=f['bytes'] or count!=f['product_count'] or 'sha256:'+digest.hexdigest()!=f['digest']:raise ValueError('Incomplete or changed snapshot: digest/count/size mismatch')
 return {'action':'publish-acp','updatedAt':m['data_updated_at'],'digest':f['digest'],'bytes':size,'sourceCount':count,'rows':rows,'seconds':round(time.monotonic()-start,2)}
def call(payload):
 issuer=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'];issuer+=('&' if '?' in issuer else '?')+urllib.parse.urlencode({'audience':ENDPOINT})
 req=urllib.request.Request(issuer,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
 with urllib.request.urlopen(req,timeout=20) as r:token=json.load(r)['value']
 print('::add-mask::'+token)
 req=urllib.request.Request(ENDPOINT,data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':UA})
 with opener.open(req,timeout=120) as r:return json.load(r)
def main():
 if '--inspect' in sys.argv:
  p=collect();print(json.dumps({**{k:v for k,v in p.items() if k!='rows'},'matched':len(p['rows']),'examples':p['rows'][:3]},ensure_ascii=False));return
 state=call({'action':'acp-state'})
 snapshot_failed=False
 if state.get('due'):
  try:
   print(json.dumps(call(collect())))
  except Exception as error:
   snapshot_failed=True
   print('Full snapshot failed; continuing with existing offers and photo maintenance.',file=sys.stderr)
   try:
    print(json.dumps(call({'action':'acp-failure','message':str(error)[:300],'expectedLastSuccess':state.get('lastSuccess')})))
   except Exception as reporting_error:
    print('Could not record snapshot failure: '+type(reporting_error).__name__,file=sys.stderr)
 else:
  print(json.dumps({key:state.get(key) for key in ('due','lastSuccess','nextAt','count','failures')}))
 detail_failures = 0
 throttled = False
 deadline=time.monotonic()+170
 for _ in range(4):
  stop=False
  plan=call({'action':'acp-refresh-plan'});results=[]
  for product_id in plan['ids']:
   if time.monotonic()>=deadline:break
   if not re.fullmatch(r'\d+',str(product_id)):raise ValueError('Invalid refresh ID')
   try:
    data=get('https://wildmart.md/api/public/v1/products/'+str(product_id)+'?lang=ro',131072);item=data.get('item',{})
    results.append({'id':str(product_id),'updatedAt':data.get('data_updated_at'),'item':{k:item.get(k) for k in ['product_id','data_stale','canonical_url','price','availability']}})
   except Exception as error:
    results.append({'id':str(product_id),'error':type(error).__name__})
    if getattr(error,'code',0) in (429,503):
     stop=True
     throttled=True
     break
   time.sleep(2)
  if results:
   summary = call({'action':'refresh-acp','results':results})
   print(json.dumps(summary))
   if summary.get('skipped'):
    break
   attempted, verified = summary['attempted'], summary['verified']
   if attempted != len(results) or not 0 <= verified <= attempted:
    raise ValueError('Invalid detail verification summary')
   detail_failures += attempted - verified
   if verified == 0:
    stop = True
  if stop or len(results)<20:break
 # Finish a resumable image queue without waiting a day for five-photo ticks.
 for batch in range(15):
  result=call({});print(json.dumps({'photoBatch':batch,'merchantPhotos':result.get('merchantPhotos'),'errors':result.get('errors')}))
  if result.get('errors'):raise RuntimeError('Maintenance reported errors')
  if result.get('merchantPhotos',{}).get('checked',0)<5:break
  time.sleep(6)
 failures = []
 if snapshot_failed:
  failures.append('Full snapshot failed; see source history for retry timing.')
 if detail_failures:
  failures.append(f'{detail_failures} attempted detail checks could not be verified.')
 if throttled:
  failures.append('The merchant returned 429/503; remaining detail requests were stopped.')
 if failures:
  raise SystemExit(' '.join(failures))
if __name__=='__main__':main()
