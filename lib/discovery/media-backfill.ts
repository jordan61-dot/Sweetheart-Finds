import {db,now,catalogRevision,catalogBatch,productStatements} from '../server';
import {imageSchema,type Product} from '../domain';
import {sourceJSON} from './transport';
import {matchImage,type ImageCandidate} from './media';
const clean=(s:unknown)=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').slice(0,500);
export async function backfillNext(){
 const key='media-backfill',at=now(),claim=crypto.randomUUID();await db().prepare("INSERT OR IGNORE INTO config(key,data) VALUES (?,'{}')").bind(key).run();
 const state=await db().prepare("UPDATE config SET data=json_set(data,'$.lease',?,'$.leaseUntil',?) WHERE key=? AND COALESCE(json_extract(data,'$.leaseUntil'),'')<=? RETURNING data").bind(claim,new Date(Date.now()+60000).toISOString(),key,at).first<{data:string}>();if(!state)throw Error('Image backfill is already running');
 const prior=JSON.parse(state.data);
 try{
 const row=await db().prepare('SELECT id,data FROM products WHERE archived=0 AND id>? ORDER BY id LIMIT 1').bind(prior.after||'').first<{id:string;data:string}>();
 if(!row){await db().prepare("UPDATE config SET data=json_set(data,'$.complete',1,'$.leaseUntil','','$.finishedAt',?) WHERE key=? AND json_extract(data,'$.lease')=?").bind(now(),key,claim).run();return {complete:true};}
 const rate=await db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data WHERE CAST(config.data AS INTEGER)<=? RETURNING data').bind('rate:commons',String(Date.now()),Date.now()-1500).first();if(!rate)throw Error('Commons request throttle active; wait two seconds');
 const budget=await db().prepare("INSERT INTO config(key,data) VALUES (?,'1') ON CONFLICT(key) DO UPDATE SET data=CAST(CAST(config.data AS INTEGER)+1 AS TEXT) WHERE CAST(config.data AS INTEGER)<100 RETURNING data").bind('budget:commons:'+at.slice(0,10)).first();if(!budget)throw Error('Commons daily budget exhausted; resume tomorrow');
 const product=JSON.parse(row.data) as Product;const query=product.title.replace(/["|]/g,' ').slice(0,200);const url=new URL('https://commons.wikimedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'3',prop:'imageinfo',iiprop:'url|mime|size|extmetadata'}).toString();
 const response=await sourceJSON(url.toString(),{headers:{'User-Agent':'SweetheartFinds/2.3 (https://sweetheart-finds.jordanmullens12.chatgpt.site)'}});
 if(response.error)throw Error('Commons API returned an error');
 const statements:D1PreparedStatement[]=[];let candidates=0;
 for(const page of Object.values(response.query?.pages||{}) as any[]){const info=page.imageinfo?.[0],meta=info?.extmetadata;if(!info||!meta||info.width<300||info.height<300||!/^image\/(jpeg|png|webp)$/.test(info.mime))continue;const licenseName=clean(meta.LicenseShortName?.value),license=licenseName.startsWith('CC BY-SA ')?'CC-BY-SA':licenseName.startsWith('CC BY ')?'CC-BY':licenseName==='CC0'?'CC0':null;if(!license)continue;const licenseUrl=String(meta.LicenseUrl?.value||'').replace(/^http:/,'https:');if(!licenseUrl.startsWith('https://creativecommons.org/'))continue;if(new URL(info.url).hostname!=='upload.wikimedia.org')continue;
 const candidate:ImageCandidate={url:info.url,sourceUrl:info.descriptionurl,identifiers:{},title:clean(meta.ObjectName?.value||page.title),license,licenseUrl,attribution:clean(meta.Artist?.value)||'Creator not established — review required',expiresAt:new Date(Date.now()+365*86400000).toISOString(),contentType:info.mime};
 const match=matchImage(product,candidate);statements.push(db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind('media:'+row.id+':commons:'+page.pageid,JSON.stringify({productId:row.id,candidate,match,at:now(),source:'Wikimedia Commons',width:info.width,height:info.height})));candidates++;
 }
 const next={...prior,after:row.id,processed:(prior.processed||0)+1,candidates:(prior.candidates||0)+candidates,lastAt:now(),leaseUntil:'',error:null};
 const guard=crypto.randomUUID();await db().batch([db().prepare("INSERT INTO catalog_write_guards(id,valid) VALUES (?,CASE WHEN json_extract((SELECT data FROM config WHERE key=?),'$.lease')=? THEN 1 ELSE 0 END)").bind(guard,key,claim),...statements,db().prepare('UPDATE config SET data=? WHERE key=?').bind(JSON.stringify(next),key),db().prepare('DELETE FROM catalog_write_guards WHERE id=?').bind(guard)]);
 return {complete:false,processed:next.processed,candidates,product:product.title};
 }catch(e){await db().prepare("UPDATE config SET data=json_set(data,'$.leaseUntil','','$.error',?) WHERE key=? AND json_extract(data,'$.lease')=?").bind((e as Error).message,key,claim).run();throw e;}
}
export async function reviewMedia(key:string,approve:boolean){if(!key.startsWith('media:')||key.length>300)throw Error('Invalid media identity');const row=await db().prepare('SELECT data FROM config WHERE key=?').bind(key).first<{data:string}>();if(!row)throw Error('Candidate missing');const media=JSON.parse(row.data),c=media.candidate as ImageCandidate;if(!approve){await db().prepare('UPDATE config SET data=? WHERE key=? AND data=?').bind(JSON.stringify({...media,review:'rejected',reviewedAt:now()}),key,row.data).run();return {ok:true};}
 if(!c||media.match?.decision==='rejected'||media.review==='rejected')throw Error('Rejected or invalid candidate cannot be approved');
 if(new URL(c.url).hostname!=='upload.wikimedia.org'||!c.licenseUrl.startsWith('https://creativecommons.org/')||!['CC0','CC-BY','CC-BY-SA'].includes(c.license))throw Error('Only Commons candidates with recorded reuse licenses can be approved here');
 if(!c.expiresAt||Date.parse(c.expiresAt)<=Date.now())throw Error('Permission needs re-verification');
 const response=await fetch(c.url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok||!/^image\/(jpeg|png|webp)(;|$)/.test(response.headers.get('content-type')||''))throw Error('Photo is not currently accessible');
 const revision=await catalogRevision(),p=await db().prepare('SELECT data FROM products WHERE id=? AND archived=0').bind(media.productId).first<{data:string}>();if(!p)throw Error('Product has been archived or merged; reassociate manually');const product=JSON.parse(p.data) as Product;if(product.images.length>=12)throw Error('Gallery is full');
 const image=imageSchema.parse({url:c.url,source:c.licenseUrl,permission:c.license,attribution:c.attribution+' — '+c.sourceUrl,verifiedAt:now(),expiresAt:c.expiresAt});if(!product.images.some(i=>i.url===image.url))product.images.push(image);await catalogBatch([...productStatements(product),db().prepare('UPDATE config SET data=? WHERE key=?').bind(JSON.stringify({...media,review:'approved',reviewedAt:now(),humanIdentityConfirmation:true}),key)],revision);return {ok:true};
}
