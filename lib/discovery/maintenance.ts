import {env} from 'cloudflare:workers';
import {db,now} from '../server';
import type {Product} from '../domain';
import {publicUrl} from './feed';
import {tickFeeds} from './feed-runner';
import {backfillNext} from './media-backfill';
import {verifyGitHubIdentity,type CollectorClaims} from './github-identity';
export async function authenticateWorkflow(request:Request){const token=request.headers.get('authorization');if(!token?.startsWith('Bearer '))throw Object.assign(Error('GitHub workflow authentication required'),{status:401});const claims=await verifyGitHubIdentity(token.slice(7));const key='oidc-used:'+claims.jti;const accepted=await db().prepare('INSERT OR IGNORE INTO config(key,data) VALUES (?,?) RETURNING key').bind(key,String(claims.expires)).first();if(!accepted)throw Object.assign(Error('Collector credential was already used'),{status:409});await db().prepare("DELETE FROM config WHERE key LIKE 'oidc-used:%' AND CAST(data AS INTEGER)<?").bind(Math.floor(Date.now()/1000)-3600).run();return claims;}
export async function auditNextImage(){
 const cutoff=new Date(Date.now()-7*86400000).toISOString();
 const row=await db().prepare("SELECT p.id,p.data FROM products p LEFT JOIN config c ON c.key='image-audit:'||p.id WHERE p.archived=0 AND json_array_length(json_extract(p.data,'$.images'))>0 AND (c.key IS NULL OR json_extract(c.data,'$.at')<?) ORDER BY COALESCE(json_extract(c.data,'$.at'),''),p.id LIMIT 1").bind(cutoff).first<{id:string;data:string}>();
 if(!row)return {checked:0,reason:'Existing images have recent checks'};
 const product=JSON.parse(row.data) as Product;const hosts=new Set(['covers.openlibrary.org','upload.wikimedia.org',...String((env as unknown as {FEED_IMAGE_ALLOWED_HOSTS?:string}).FEED_IMAGE_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean)]);const results=[];
 for(const image of product.images.slice(0,3)){let status='unknown',httpStatus:number|null=null,contentType:string|null=null;try{const u=publicUrl(image.url);if(image.expiresAt&&Date.parse(image.expiresAt)<=Date.now())status='permission-expired';else if(!hosts.has(u.hostname))status='host-not-approved';else{const response=await fetch(u.toString(),{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(5000)});httpStatus=response.status;contentType=response.headers.get('content-type')?.split(';')[0]||null;status=response.ok&&/^image\/(jpeg|png|webp|gif|avif)$/.test(contentType||'')?'reachable':response.status===404||response.status===410?'broken':response.ok?'invalid-content-type':'verification-failed';}}catch{status='verification-failed';}results.push({url:image.url,status,httpStatus,contentType,declaredPermission:image.permission,identityAssessment:'Not established by availability checks'});}
 const data={productId:product.id,at:now(),results};await db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind('image-audit:'+row.id,JSON.stringify(data)).run();return {checked:results.length,productId:row.id,results:results.map(({url,...rest})=>rest)};
}
export async function maintenanceTick(identity:CollectorClaims|{event:'owner-triggered';runId:string;attempt:string}){
 const key='automation-runtime',at=now(),lease=crypto.randomUUID();await db().prepare("INSERT OR IGNORE INTO config(key,data) VALUES (?,'{}')").bind(key).run();
 const claimed=await db().prepare("UPDATE config SET data=json_set(data,'$.lease',?,'$.leaseUntil',?) WHERE key=? AND COALESCE(json_extract(data,'$.leaseUntil'),'')<=? RETURNING data").bind(lease,new Date(Date.now()+180000).toISOString(),key,at).first<{data:string}>();if(!claimed)return {skipped:true,reason:'Maintenance already running'};
 const prior=JSON.parse(claimed.data),errors:string[]=[];let feeds:any,media:any,audit:any;
 try{try{feeds=await tickFeeds();}catch(e){errors.push('Feeds: '+(e as Error).message);}try{media=await backfillNext();}catch(e){errors.push('Media discovery: '+(e as Error).message);}try{audit=await auditNextImage();}catch(e){errors.push('Image audit: '+(e as Error).message);}
 const run={at,finishedAt:now(),event:identity.event,runId:identity.runId,attempt:identity.attempt,feeds,media,audit,errors};const next={leaseUntil:'',lastRun:run,lastScheduledAt:identity.event==='schedule'?at:prior.lastScheduledAt,lastSuccessfulAt:errors.length?prior.lastSuccessfulAt:at,nextExpectedAt:new Date(Date.now()+20*60000).toISOString(),runs:[run,...(prior.runs||[])].slice(0,30)};
 await db().prepare("UPDATE config SET data=? WHERE key=? AND json_extract(data,'$.lease')=?").bind(JSON.stringify(next),key,lease).run();await db().prepare("DELETE FROM config WHERE key LIKE 'budget:%' AND substr(key,-10)<?").bind(new Date(Date.now()-35*86400000).toISOString().slice(0,10)).run();return run;
 }catch(e){await db().prepare("UPDATE config SET data=json_set(data,'$.leaseUntil','','$.lastError',?) WHERE key=? AND json_extract(data,'$.lease')=?").bind((e as Error).message,key,lease).run();throw e;}
}
