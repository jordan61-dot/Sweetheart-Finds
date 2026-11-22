import {env} from 'cloudflare:workers';
import {db,now,catalogRevision,catalogBatch,productStatements} from '../server';
import {mergeProductEvidence,stableId,type Product} from '../domain';
import {feedSchema,assertFeed,readFeed,parseFeed,type Feed} from './feed';
import {matchImage,type ImageCandidate} from './media';
type State={nextAt?:string;lease?:string;leaseUntil?:string;failures?:number;lastSuccess?:string;error?:string;etag?:string;modified?:string;offset?:number;pending?:Product[];lastRecords?:Product[];runs?:unknown[]};
const config=async<T>(key:string)=>{const r=await db().prepare('SELECT data FROM config WHERE key=?').bind(key).first<{data:string}>();return r?JSON.parse(r.data) as T:null;};
const settings=()=>env as unknown as {FEED_ALLOWED_HOSTS?:string;FEED_IMAGE_ALLOWED_HOSTS?:string;SWEETHEART_COLLECTOR_TOKEN?:string};
export const allowedFeedHosts=()=>String(settings().FEED_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean);
export async function feedOverview(){
 const rows=await db().prepare("SELECT key,data FROM config WHERE key LIKE 'feed:%' ORDER BY key LIMIT 50").all<{key:string;data:string}>();
 const time=Date.now();
 return Promise.all(rows.results.map(async row=>{
  const feed=JSON.parse(row.data) as Feed;
  const {pending,lastRecords,...state}=await config<State>('feed-state:'+feed.id)||{};
  const permissionExpired=Date.parse(feed.permissionExpiresAt)<=time;
  const eligible=feed.enabled&&!permissionExpired;
  return {
   feed,state,permissionExpired,active:Date.parse(state.leaseUntil||'')>time,pending:pending?.length||0,checkpoint:state.offset||0,
   overdue:eligible&&!!state.nextAt&&Date.parse(state.nextAt)<time-3600000,
   operational:eligible&&!!state.lastSuccess
  };
 }));
}

export async function saveFeed(raw:unknown){
 const feed=feedSchema.parse(raw);
 if(feed.enabled)publicHostCheck(feed);
 const feedKey='feed:'+feed.id, stateKey='feed-state:'+feed.id;
 const previous=await config<Feed>(feedKey);
 if(previous&&(previous.url!==feed.url||previous.name!==feed.name))
  throw Error('Use a new feed ID when changing source identity or URL');
 const serialized=JSON.stringify(feed);
 if(previous&&JSON.stringify(previous)===serialized)return {ok:true};

 // Fence edits against a concurrent collector or owner edit in the same transaction.
 const guard=crypto.randomUUID();
 await db().batch([
  db().prepare(`INSERT INTO catalog_write_guards(id,valid) VALUES (?,CASE WHEN
   (SELECT data FROM config WHERE key=?) IS ?
   AND COALESCE((SELECT json_extract(data,'$.leaseUntil') FROM config WHERE key=?),'') <= ?
   THEN 1 ELSE 0 END)`).bind(guard,feedKey,previous?JSON.stringify(previous):null,stateKey,now()),
  db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind(feedKey,serialized),
  db().prepare(`UPDATE config SET data=json_remove(data,'$.pending','$.lastRecords','$.etag','$.modified',
   '$.offset','$.lease','$.leaseUntil','$.nextAt','$.failures','$.error','$.lastSuccess') WHERE key=?`).bind(stateKey),
  db().prepare('DELETE FROM catalog_write_guards WHERE id=?').bind(guard)
 ]).catch(error=>{
  if(error instanceof Error&&error.message.includes('CHECK constraint failed'))
   throw Error('Feed configuration changed or a collector is active. Reload before saving.');
  throw error;
 });
 return {ok:true};
}
function publicHostCheck(f:Feed){const allowed=String(settings().FEED_IMAGE_ALLOWED_HOSTS||'').split(',').map(v=>v.trim());if(f.imageHosts.some(h=>!allowed.includes(h)))throw Error('Image hosts require FEED_IMAGE_ALLOWED_HOSTS configuration');if(!allowedFeedHosts().includes(new URL(f.url).hostname))throw Error('Configure this merchant hostname in FEED_ALLOWED_HOSTS before registering the feed');}
// Keep the existing ten-record ceiling and bound image requests per checkpoint.
function collectionPage(pending:Product[], offset:number){
 const page:Product[]=[];
 let images=0;
 for(const product of pending.slice(offset,offset+10)){
  const count=product.images.length;
  if(page.length&&images+count>12)break;
  page.push(structuredClone(product));
  images+=count;
 }
 return page;
}

async function verifyFeedPhotos(source:Product, productId:string, existing:Product|undefined, feed:Feed){
 const photos:Product['images']=[];
 const statements:D1PreparedStatement[]=[];
 if(!feed.imagesAllowed)return {photos,statements};
 const gallery=new Set(existing?.images.map(image=>image.url));
 const seen=new Set<string>();
 for(const image of source.images){
  if(seen.has(image.url)||(!gallery.has(image.url)&&gallery.size>=12))continue;
  seen.add(image.url);
  const candidate:ImageCandidate={
   url:image.url,sourceUrl:source.sourceUrl,sourceProduct:source.identifiers.sourceProduct,
   sourceVariant:source.identifiers.sourceVariant,identifiers:source.identifiers,title:source.title,
   license:image.permission,licenseUrl:image.source,attribution:image.attribution,expiresAt:feed.permissionExpiresAt
  };
  try{
   if(!feed.imageHosts.includes(new URL(image.url).hostname))continue;
   const response=await fetch(image.url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(2000)});
   candidate.verifiedAt=response.ok?now():undefined;
   candidate.contentType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  }catch{
   // Keep evidence for the dashboard. A failed request has no verification timestamp.
  }
  const match=matchImage(source,candidate);
  const key='media:'+source.id+':'+stableId('image',image.url);
  statements.push(db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data')
   .bind(key,JSON.stringify({productId,candidate,match,feed:feed.id,at:now()})));
  if(match.decision==='approved'){
   gallery.add(image.url);
   photos.push({...image,verifiedAt:candidate.verifiedAt,expiresAt:feed.permissionExpiresAt});
  }
 }
 return {photos,statements};
}

export async function runFeed(id:string,manual=false){
 const f=await config<Feed>('feed:'+id);if(!f)throw Error('Feed not registered');feedSchema.parse(f);publicHostCheck(f);assertFeed(f,allowedFeedHosts());
 const key='feed-state:'+id,at=now(),lease=crypto.randomUUID();await db().prepare("INSERT OR IGNORE INTO config(key,data) VALUES (?,'{}')").bind(key).run();
 const claim=await db().prepare("UPDATE config SET data=json_set(data,'$.lease',?,'$.leaseUntil',?) WHERE key=? AND COALESCE(json_extract(data,'$.leaseUntil'),'')<=? AND COALESCE(json_extract(data,'$.nextAt'),'')<=? AND COALESCE(json_extract(data,'$.failures'),0)<3 AND (SELECT data FROM config WHERE key=?)=? RETURNING data").bind(lease,new Date(Date.now()+120000).toISOString(),key,at,at,'feed:'+id,JSON.stringify(f)).first<{data:string}>();
 if(!claim)return {ok:false,skipped:true,reason:'Not due, already leased, or needs recovery after three failures'};
 const claimedState=JSON.parse(claim.data) as State;
 let state=claimedState;
 const mode=manual?'owner-triggered':'service-triggered';
 try{
  if(!state.pending){const budget=await db().prepare("INSERT INTO config(key,data) VALUES (?,'1') ON CONFLICT(key) DO UPDATE SET data=CAST(CAST(config.data AS INTEGER)+1 AS TEXT) WHERE CAST(config.data AS INTEGER)<8 RETURNING data").bind('budget:feed:'+id+':'+at.slice(0,10)).first();if(!budget)throw Error('Feed daily request budget exhausted');const response=await readFeed(f,allowedFeedHosts(),state.etag,state.modified);if(response.unchanged){if(!state.lastRecords)throw Error('304 without prior complete feed; owner must reset validators');state.pending=state.lastRecords.map(p=>({...p,observedAt:at,listings:p.listings.map(l=>({...l,observedAt:at}))}));}else{state.pending=parseFeed(response.text,f,at).map(r=>r.product);state.etag=response.etag||undefined;state.modified=response.modified||undefined;}state.offset=0;}
  const revision=await catalogRevision();
  const page=collectionPage(state.pending,state.offset||0);
  const statements:D1PreparedStatement[]=[];
  let assigned=0;
  for(const product of page){
   const redirect=await db().prepare('SELECT data FROM config WHERE key=?').bind('merge:'+product.id).first<{data:string}>();
   const productId=redirect?.data||product.id!;
   const row=await db().prepare('SELECT data,archived FROM products WHERE id=?').bind(productId).first<{data:string;archived:number}>();
   if(row?.archived)continue;
   const existing=row?JSON.parse(row.data) as Product:undefined;
   const verified=await verifyFeedPhotos(product,productId,existing,f);
   statements.push(...verified.statements);
   assigned+=verified.photos.length;
   const incoming={...product,id:productId,images:verified.photos};
   statements.push(...productStatements(existing?mergeProductEvidence(existing,incoming):incoming));
  }
  const offset=(state.offset||0)+page.length,done=offset>=state.pending.length;state={...state,offset:done?0:offset,lastRecords:done?state.pending:state.lastRecords,pending:done?undefined:state.pending,failures:0,error:undefined,lease:undefined,leaseUntil:undefined,lastSuccess:done?at:state.lastSuccess,nextAt:new Date(Date.now()+(done?f.intervalHours*3600000:60000)).toISOString(),runs:[{at,mode,records:page.length,imagesAssigned:assigned,checkpoint:offset,complete:done},...(state.runs||[])].slice(0,30)};
  // The lease and catalog revision are checked in the same D1 transaction as every write.
  const guard=crypto.randomUUID();statements.unshift(db().prepare("INSERT INTO catalog_write_guards(id,valid) VALUES (?,CASE WHEN json_extract((SELECT data FROM config WHERE key=?),'$.lease')=? AND json_extract((SELECT data FROM config WHERE key=?),'$.leaseUntil')>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND (SELECT data FROM config WHERE key=?)=? AND julianday(?)>julianday('now') THEN 1 ELSE 0 END)").bind(guard,key,lease,key,'feed:'+id,JSON.stringify(f),f.permissionExpiresAt));statements.push(db().prepare('DELETE FROM catalog_write_guards WHERE id=?').bind(guard),db().prepare('UPDATE config SET data=? WHERE key=?').bind(JSON.stringify(state),key));await catalogBatch(statements,revision);return {ok:true,records:page.length,imagesAssigned:assigned,complete:done,nextAt:state.nextAt};
 }catch(error){
  const failures=(claimedState.failures||0)+1;
  const message=(error instanceof Error?error.message:'Collector failed').slice(0,500);
  const retryAfter=Number((error as {retryAfter?:number})?.retryAfter||0);
  const delay=Math.min(86400000,Math.max(300000*2**failures,retryAfter*1000));
  const nextAt=new Date(Date.now()+delay).toISOString();
  const runs=[{at,mode,error:message,checkpoint:claimedState.offset||0,complete:false,nextAt},
   ...(claimedState.runs||[])].slice(0,30);
  // Fence the error record too. A late collector must not change a replacement run.
  await db().prepare(`UPDATE config SET data=json_set(
   json_remove(data,'$.lease'),'$.failures',?,'$.error',?,'$.leaseUntil','','$.nextAt',?,'$.runs',json(?))
   WHERE key=? AND json_extract(data,'$.lease')=?`)
   .bind(failures,message,nextAt,JSON.stringify(runs),key,lease).run();
  throw error;
 }
}
export async function resetFeed(id:string){
 const key='feed-state:'+id;
 const reset=await db().prepare(`UPDATE config
  SET data=json_set(json_remove(data,'$.lease'),'$.failures',0,'$.nextAt','','$.leaseUntil','')
  WHERE key=? AND COALESCE(json_extract(data,'$.leaseUntil'),'')<=? RETURNING key`).bind(key,now()).first();
 if(!reset)throw Error('No feed run to recover, or a collector is active.');
 return {ok:true};
}
export async function tickFeeds(){const list=await feedOverview();const due=list.filter(x=>x.feed.enabled&&!x.permissionExpired&&!x.active&&(!x.state.nextAt||x.state.nextAt<=now())&&(x.state.failures||0)<3);due.sort((a,b)=>(a.state.nextAt||'').localeCompare(b.state.nextAt||'')||a.feed.id.localeCompare(b.feed.id));const results=[];for(const item of due.slice(0,2)){try{results.push({id:item.feed.id,...await runFeed(item.feed.id)});}catch(error){results.push({id:item.feed.id,error:(error as Error).message});}}return {at:now(),eligible:due.length,results};}
export async function authenticateCollector(r:Request){const expected=settings().SWEETHEART_COLLECTOR_TOKEN;if(!expected||expected.length<32)throw Object.assign(Error('Collector service authentication is not configured'),{status:503});const supplied=r.headers.get('authorization')?.replace(/^Bearer /,'')||'';const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([digest(expected),digest(supplied)]);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];if(mismatch)throw Object.assign(Error('Unauthorized collector'),{status:401});}
