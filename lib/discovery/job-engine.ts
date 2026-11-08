import {retryDelay} from './intelligence.ts';
import type {SourcePolicy} from './registry.ts';
import type {DiscoveryResult} from './openlibrary.ts';
export type JobDeps={database:D1Database;clock:()=>string;policy:(id:string)=>SourcePolicy|undefined;request:(source:string,query:string,page:number)=>Promise<DiscoveryResult>};
const conflict=(message:string)=>Object.assign(Error(message),{status:409});
export async function reserveRequest(d:JobDeps,source:string){
 const p=d.policy(source);if(!p||!p.dailyRequests)throw Error('Source has no authorized request budget');
 const at=d.clock(),ms=Date.parse(at);
 const health=await d.database.prepare('SELECT retry_after FROM source_health WHERE id=?').bind(source).first<{retry_after:string|null}>();
 if(health?.retry_after&&health.retry_after>at)throw Object.assign(Error('Source cooling down until '+health.retry_after),{status:429});
 // Reserve rate first. Failed/throttled attempts never perform an outbound request.
 const rate=await d.database.prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data WHERE CAST(config.data AS INTEGER)<=? RETURNING data').bind('rate:'+source,String(ms),ms-p.minIntervalMs).first();
 if(!rate)throw Object.assign(Error('Source request throttle active'),{status:429});
 const budget=await d.database.prepare("INSERT INTO config(key,data) VALUES (?,'1') ON CONFLICT(key) DO UPDATE SET data=CAST(CAST(config.data AS INTEGER)+1 AS TEXT) WHERE CAST(config.data AS INTEGER)<? RETURNING data").bind('budget:'+source+':'+at.slice(0,10),p.dailyRequests).first();
 if(!budget)throw Object.assign(Error('Daily free request budget exhausted'),{status:429});
}
export async function runJob(d:JobDeps,id:string){
 const at=d.clock();const job=await d.database.prepare("UPDATE discovery_jobs SET status='running',attempts=attempts+1,updated_at=? WHERE id=? AND status IN ('queued','retry') AND attempts<3 AND (next_at IS NULL OR next_at<=?) RETURNING *").bind(at,id,at).first<any>();
 if(!job)throw conflict('Job already claimed, cancelled, finished, or cooling down.');
 // Lease identity prevents a late request from overwriting a recovered/cancelled job.
 try{
  await reserveRequest(d,job.source);const result=await d.request(job.source,job.query,job.page);
  const saved=await d.database.prepare("UPDATE discovery_jobs SET status='review',next_at=NULL,updated_at=?,data=? WHERE id=? AND status='running' AND attempts=? AND updated_at=? RETURNING id").bind(d.clock(),JSON.stringify({result,checkpoint:{page:job.page,nextPage:job.page<20&&result.total>job.page*12?job.page+1:null},note:'References awaiting review; no sale stock implied.'}),id,job.attempts,at).first();
  if(!saved)throw conflict('Job changed while its request was running; late results discarded.');
  await d.database.prepare('INSERT INTO source_health(id,failures,last_success,data) VALUES (?,0,?,?) ON CONFLICT(id) DO UPDATE SET failures=0,last_success=excluded.last_success,last_error=NULL,retry_after=NULL,data=excluded.data').bind(job.source,d.clock(),JSON.stringify({products:result.products.length,offers:0})).run();
  return {ok:true,result};
 }catch(e){
  if((e as any)?.status===409)throw e;
  const message=e instanceof Error?e.message:'Source unavailable',next=new Date(Date.parse(d.clock())+retryDelay(job.attempts,Number((e as any)?.retryAfter)||0)).toISOString();
  const saved=await d.database.prepare("UPDATE discovery_jobs SET status=?,next_at=?,updated_at=?,data=? WHERE id=? AND status='running' AND attempts=? AND updated_at=? RETURNING id").bind(job.attempts>=3?'failed':'retry',next,d.clock(),JSON.stringify({error:message,preservedCatalog:true,checkpoint:{page:job.page}}),id,job.attempts,at).first();
  if(saved)await d.database.prepare('INSERT INTO source_health(id,failures,last_error,retry_after,data) VALUES (?,1,?,?,?) ON CONFLICT(id) DO UPDATE SET failures=failures+1,last_error=excluded.last_error,retry_after=CASE WHEN source_health.retry_after>excluded.retry_after THEN source_health.retry_after ELSE excluded.retry_after END').bind(job.source,message,next,'{}').run();
  throw e;
 }
}
export async function recoverJob(d:JobDeps,id:string){
 const at=d.clock(),cutoff=new Date(Date.parse(at)-120000).toISOString();
 const row=await d.database.prepare("UPDATE discovery_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'retry' END,next_at=NULL,updated_at=?,data=json_set(data,'$.error','Interrupted request recovered; catalog unchanged.') WHERE id=? AND status='running' AND updated_at<=? RETURNING id").bind(at,id,cutoff).first();
 if(!row)throw conflict('Only a running job interrupted for at least two minutes can be recovered.');return {ok:true};
}
export async function advanceJob(d:JobDeps,id:string){
 const row=await d.database.prepare("UPDATE discovery_jobs SET status='queued',page=page+1,attempts=0,next_at=NULL,updated_at=?,data=json_set(data,'$.note','Next page queued; press Run to request it.') WHERE id=? AND status='review' AND page<20 AND json_extract(data,'$.checkpoint.nextPage')=page+1 RETURNING id").bind(d.clock(),id).first();
 if(!row)throw conflict('No reviewed next-page checkpoint is available.');return {ok:true};
}
