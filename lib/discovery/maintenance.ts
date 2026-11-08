import {env} from 'cloudflare:workers';
import {db,now} from '../server';
import type {Product} from '../domain';
import {publicUrl} from './feed';
import {tickFeeds} from './feed-runner';
import {backfillNext} from './media-backfill';
import {verifyGitHubIdentity,type CollectorClaims} from './github-identity';
export async function authenticateWorkflow(request:Request){const token=request.headers.get('authorization');if(!token?.startsWith('Bearer '))throw Object.assign(Error('GitHub workflow authentication required'),{status:401});const claims=await verifyGitHubIdentity(token.slice(7));const key='oidc-used:'+claims.jti;const accepted=await db().prepare('INSERT OR IGNORE INTO config(key,data) VALUES (?,?) RETURNING key').bind(key,String(claims.expires)).first();if(!accepted)throw Object.assign(Error('Collector credential was already used'),{status:409});await db().prepare("DELETE FROM config WHERE key LIKE 'oidc-used:%' AND CAST(data AS INTEGER)<?").bind(Math.floor(Date.now()/1000)-3600).run();return claims;}
// Some approved cover URLs redirect to another path on the same origin.
// Never follow an image redirect to a different host or a non-HTTPS URL.
export async function imageHead(url:string){
 const origin=publicUrl(url).origin;let current=url;
 for(let hop=0;hop<3;hop++){
  const response=await fetch(current,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(![301,302,303,307,308].includes(response.status))return response;
  const location=response.headers.get('location');if(!location||hop===2)return response;
  const next=publicUrl(new URL(location,current).toString());if(next.origin!==origin)return response;
  current=next.toString();
 }
 throw Error('Image redirect limit reached');
}
export async function auditNextImage(){
 const cutoff=new Date(Date.now()-7*86400000).toISOString();
 const row=await db().prepare("SELECT p.id,p.data,c.data AS audit FROM products p LEFT JOIN config c ON c.key='image-audit:'||p.id WHERE p.archived=0 AND json_array_length(json_extract(p.data,'$.images'))>0 AND (c.key IS NULL OR json_extract(c.data,'$.at')<? OR COALESCE(json_extract(c.data,'$.complete'),0)=0 OR COALESCE(json_extract(c.data,'$.gallery'),'')!=json_extract(p.data,'$.images')) ORDER BY COALESCE(json_extract(c.data,'$.at'),''),p.id LIMIT 1").bind(cutoff).first<{id:string;data:string;audit:string|null}>();
 if(!row)return {checked:0,reason:'Existing images have recent checks'};
 const product=JSON.parse(row.data) as Product;const hosts=new Set(['covers.openlibrary.org','upload.wikimedia.org',...String((env as unknown as {FEED_IMAGE_ALLOWED_HOSTS?:string}).FEED_IMAGE_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean)]);const gallery=JSON.stringify(product.images),prior=JSON.parse(row.audit||'{}');const results:any[]=prior.gallery===gallery&&prior.at>=cutoff?prior.results||[]:[];let checked=0;
 for(const image of product.images.filter(image=>!results.some(result=>result.url===image.url)).slice(0,3)){checked++;let status='unknown',httpStatus:number|null=null,contentType:string|null=null;try{const u=publicUrl(image.url);if(image.expiresAt&&Date.parse(image.expiresAt)<=Date.now())status='permission-expired';else if(!hosts.has(u.hostname))status='host-not-approved';else{const response=await imageHead(u.toString());httpStatus=response.status;contentType=response.headers.get('content-type')?.split(';')[0]||null;status=response.ok&&/^image\/(jpeg|png|webp|gif|avif)$/.test(contentType||'')?'reachable':response.status===404||response.status===410?'broken':response.ok?'invalid-content-type':'verification-failed';}}catch{status='verification-failed';}results.push({url:image.url,status,httpStatus,contentType,declaredPermission:image.permission,identityAssessment:'Not established by availability checks'});}
 const complete=product.images.every(image=>results.some(result=>result.url===image.url));const data={productId:product.id,at:now(),gallery,complete,results};await db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind('image-audit:'+row.id,JSON.stringify(data)).run();return {checked,totalChecked:results.length,complete,productId:row.id,results:results.map(({url,...rest})=>rest)};
}
export async function maintenanceTick(identity:CollectorClaims|{event:'owner-triggered';runId:string;attempt:string}){
 const key='automation-runtime',at=now(),lease=crypto.randomUUID();await db().prepare("INSERT OR IGNORE INTO config(key,data) VALUES (?,'{}')").bind(key).run();
 const claimed=await db().prepare("UPDATE config SET data=json_set(data,'$.lease',?,'$.leaseUntil',?) WHERE key=? AND COALESCE(json_extract(data,'$.leaseUntil'),'')<=? RETURNING data").bind(lease,new Date(Date.now()+180000).toISOString(),key,at).first<{data:string}>();if(!claimed)return {skipped:true,reason:'Maintenance already running'};
 const prior=JSON.parse(claimed.data),errors:string[]=[];let feeds:any,media:any,audit:any;
 try{try{feeds=await tickFeeds();for(const result of feeds.results)if('error' in result)errors.push('Feed '+result.id+': '+result.error);}catch(e){errors.push('Feeds: '+(e as Error).message);}try{media=await backfillNext();}catch(e){errors.push('Media discovery: '+(e as Error).message);}try{audit=await auditNextImage();}catch(e){errors.push('Image audit: '+(e as Error).message);}
 const warnings=(audit?.results||[]).filter((r:any)=>r.status!=='reachable').map((r:any)=>'Photo audit: '+r.status+(r.httpStatus?' (HTTP '+r.httpStatus+')':''));const run={warnings,at,finishedAt:now(),event:identity.event,runId:identity.runId,attempt:identity.attempt,feeds,media,audit,errors};const next={leaseUntil:'',lastRun:run,lastScheduledAt:identity.event==='schedule'?at:prior.lastScheduledAt,lastSuccessfulAt:errors.length?prior.lastSuccessfulAt:at,nextExpectedAt:new Date(Date.now()+20*60000).toISOString(),runs:[run,...(prior.runs||[])].slice(0,30)};
 await db().prepare("UPDATE config SET data=? WHERE key=? AND json_extract(data,'$.lease')=?").bind(JSON.stringify(next),key,lease).run();await db().prepare("DELETE FROM config WHERE key LIKE 'budget:%' AND substr(key,-10)<?").bind(new Date(Date.now()-35*86400000).toISOString().slice(0,10)).run();return run;
 }catch(e){await db().prepare("UPDATE config SET data=json_set(data,'$.leaseUntil','','$.lastError',?) WHERE key=? AND json_extract(data,'$.lease')=?").bind((e as Error).message,key,lease).run();throw e;}
}
