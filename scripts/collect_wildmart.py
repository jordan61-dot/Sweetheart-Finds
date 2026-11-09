"""Official ACP snapshot consumer. No storefront scraping, image downloads or disk cache."""
import hashlib,json,os,re,sys,time,urllib.request,urllib.parse
MANIFEST='https://wildmart.md/acp/feeds/index.json'
ENDPOINT='https://sweetheart-finds.jordanmullens12.chatgpt.site/api/automation/tick'
UA='SweetheartFinds/2.3 (+https://github.com/jordan61-dot/Sweetheart-Finds)'
# Broad prefilter only; the production normalizer applies all 14 taxonomies.
RELEVANT=re.compile(r'littlest\s+pet\s+shop|my\s+little\s+pony|shopkins|num\s*noms|lalaloopsy|crumbs\s+sugar|monster\s+high|sanrio|pompompurin|hello\s+kitty|my\s+melody|usahana|mezzo\s+piano|justice|ウサハナ|メゾピアノ|ハローキティ|マイメロディ|ポムポムプリン|サンリオ',re.I)
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
   if RELEVANT.search(p.get('title','')):
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
 if state.get('due'):
  try:print(json.dumps(call(collect())))
  except Exception as e:
   print(json.dumps(call({'action':'acp-failure','message':str(e)[:300]})));raise
 else:print(json.dumps(state))
if __name__=='__main__':main()
