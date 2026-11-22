import {env} from 'cloudflare:workers';
import {db,now,catalogRevision,catalogBatch,productStatements} from '../server';
import {mergeProductEvidence,type Product} from '../domain';
import {feedSchema,assertFeed,readFeed,parseFeed,type Feed} from './feed';
import {matchImage} from './media';
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
   feed,state,permissionExpired,pending:pending?.length||0,checkpoint:state.offset||0,
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
export async function runFeed(id:string,manual=false){
 const f=await config<Feed>('feed:'+id);if(!f)throw Error('Feed not registered');feedSchema.parse(f);publicHostCheck(f);assertFeed(f,allowedFeedHosts());
 const key='feed-state:'+id,at=now(),lease=crypto.randomUUID();await db().prepare("INSERT OR IGNORE INTO config(key,data) VALUES (?,'{}')").bind(key).run();
 const claim=await db().prepare("UPDATE config SET data=json_set(data,'$.lease',?,'$.leaseUntil',?) WHERE key=? AND COALESCE(json_extract(data,'$.leaseUntil'),'')<=? AND COALESCE(json_extract(data,'$.nextAt'),'')<=? AND COALESCE(json_extract(data,'$.failures'),0)<3 AND (SELECT data FROM config WHERE key=?)=? RETURNING data").bind(lease,new Date(Date.now()+120000).toISOString(),key,at,at,'feed:'+id,JSON.stringify(f)).first<{data:string}>();
 if(!claim)return {ok:false,skipped:true,reason:'Not due, already leased, or needs recovery after three failures'};
 let state=JSON.parse(claim.data) as State;
 try{
  if(!state.pending){const budget=await db().prepare("INSERT INTO config(key,data) VALUES (?,'1') ON CONFLICT(key) DO UPDATE SET data=CAST(CAST(config.data AS INTEGER)+1 AS TEXT) WHERE CAST(config.data AS INTEGER)<8 RETURNING data").bind('budget:feed:'+id+':'+at.slice(0,10)).first();if(!budget)throw Error('Feed daily request budget exhausted');const response=await readFeed(f,allowedFeedHosts(),state.etag,state.modified);if(response.unchanged){if(!state.lastRecords)throw Error('304 without prior complete feed; owner must reset validators');state.pending=state.lastRecords.map(p=>({...p,observedAt:at,listings:p.listings.map(l=>({...l,observedAt:at}))}));}else{state.pending=parseFeed(response.text,f,at).map(r=>r.product);state.etag=response.etag||undefined;state.modified=response.modified||undefined;}state.offset=0;}
  const revision=await catalogRevision(),page=structuredClone(state.pending.slice(state.offset||0,(state.offset||0)+10)),statements:D1PreparedStatement[]=[];let assigned=0;
  for(const p of page){const verified:Product['images']=[];if(f.imagesAllowed&&p.images.length){const image=p.images[0];try{if(!f.imageHosts.includes(new URL(image.url).hostname))throw Error('Image host not approved');const response=await fetch(image.url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(2000)});const candidate={url:image.url,sourceUrl:p.sourceUrl,sourceProduct:p.identifiers.sourceProduct,sourceVariant:p.identifiers.sourceVariant,identifiers:p.identifiers,title:p.title,license:image.permission,licenseUrl:image.source,attribution:image.attribution,expiresAt:f.permissionExpiresAt,verifiedAt:response.ok?now():undefined,contentType:response.headers.get('content-type')?.split(';')[0]};const match=matchImage(p,candidate);statements.push(db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind('media:'+p.id+':primary',JSON.stringify({productId:p.id,candidate,match,feed:id,at:now()})));if(match.decision==='approved'){verified.push({...image,verifiedAt:now(),expiresAt:f.permissionExpiresAt});assigned++;}}catch{statements.push(db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind('media:'+p.id+':primary',JSON.stringify({productId:p.id,image,status:'verification-failed',at:now()})));}}p.images=verified;
   const redirect=await db().prepare('SELECT data FROM config WHERE key=?').bind('merge:'+p.id).first<{data:string}>();if(redirect)p.id=redirect.data;const existing=await db().prepare('SELECT data,archived FROM products WHERE id=?').bind(p.id!).first<{data:string;archived:number}>();if(existing?.archived)continue;const value=existing?mergeProductEvidence(JSON.parse(existing.data),p):p;statements.push(...productStatements(value));
  }
  const offset=(state.offset||0)+page.length,done=offset>=state.pending.length;state={...state,offset:done?0:offset,lastRecords:done?state.pending:state.lastRecords,pending:done?undefined:state.pending,failures:0,error:undefined,lease:undefined,leaseUntil:undefined,lastSuccess:done?at:state.lastSuccess,nextAt:new Date(Date.now()+(done?f.intervalHours*3600000:60000)).toISOString(),runs:[{at,mode:manual?'owner-triggered':'service-triggered',records:page.length,imagesAssigned:assigned,checkpoint:offset,complete:done},...(state.runs||[])].slice(0,30)};
  // The lease and catalog revision are checked in the same D1 transaction as every write.
  const guard=crypto.randomUUID();statements.unshift(db().prepare("INSERT INTO catalog_write_guards(id,valid) VALUES (?,CASE WHEN json_extract((SELECT data FROM config WHERE key=?),'$.lease')=? AND json_extract((SELECT data FROM config WHERE key=?),'$.leaseUntil')>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND (SELECT data FROM config WHERE key=?)=? AND julianday(?)>julianday('now') THEN 1 ELSE 0 END)").bind(guard,key,lease,key,'feed:'+id,JSON.stringify(f),f.permissionExpiresAt));statements.push(db().prepare('DELETE FROM catalog_write_guards WHERE id=?').bind(guard),db().prepare('UPDATE config SET data=? WHERE key=?').bind(JSON.stringify(state),key));await catalogBatch(statements,revision);return {ok:true,records:page.length,imagesAssigned:assigned,complete:done,nextAt:state.nextAt};
 }catch(error){const failures=(state.failures||0)+1;await db().prepare("UPDATE config SET data=json_set(data,'$.failures',?,'$.error',?,'$.leaseUntil','','$.nextAt',?) WHERE key=? AND json_extract(data,'$.lease')=?").bind(failures,error instanceof Error?error.message:'Collector failed',new Date(Date.now()+Math.min(86400000,Math.max(300000*2**failures,Number((error as {retryAfter?:number}).retryAfter||0)*1000))).toISOString(),key,lease).run();throw error;}
}
export async function resetFeed(id:string){
 const key='feed-state:'+id;
 const reset=await db().prepare(`UPDATE config
  SET data=json_set(json_remove(data,'$.lease'),'$.failures',0,'$.nextAt','','$.leaseUntil','')
  WHERE key=? AND COALESCE(json_extract(data,'$.leaseUntil'),'')<=? RETURNING key`).bind(key,now()).first();
 if(!reset)throw Error('No feed run to recover, or a collector is active.');
 return {ok:true};
}
export async function tickFeeds(){const list=await feedOverview();const due=list.filter(x=>x.feed.enabled&&!x.permissionExpired&&(!x.state.nextAt||x.state.nextAt<=now())&&(x.state.failures||0)<3);const results=[];for(const item of due.slice(0,2)){try{results.push({id:item.feed.id,...await runFeed(item.feed.id)});}catch(error){results.push({id:item.feed.id,error:(error as Error).message});}}return {at:now(),eligible:due.length,results};}
export async function authenticateCollector(r:Request){const expected=settings().SWEETHEART_COLLECTOR_TOKEN;if(!expected||expected.length<32)throw Object.assign(Error('Collector service authentication is not configured'),{status:503});const supplied=r.headers.get('authorization')?.replace(/^Bearer /,'')||'';const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([digest(expected),digest(supplied)]);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];if(mismatch)throw Object.assign(Error('Unauthorized collector'),{status:401});}
