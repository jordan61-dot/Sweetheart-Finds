import {z} from 'zod';
import {db,now} from '../server';
import {classifyMerchandise} from './intelligence';
import {publicUrl} from './feed';
export const ACP_POLICY='https://wildmart.md/acp/docs/';
const key='wildmart-acp';
const productUrl=(value:string)=>{const u=publicUrl(value);if(u.hostname!=='wildmart.md'||!/^\/(ro|ru)\/product\//.test(u.pathname))throw Error('Invalid merchant product URL');return u.href;};
const imageUrl=(value:unknown)=>{try{const u=publicUrl(String(value));return u.hostname==='wildmart.md'&&u.pathname.startsWith('/image/')?u.href:null;}catch{return null;}};
const media=z.array(z.object({type:z.string(),url:z.string(),alt_text:z.string().optional()}).passthrough()).max(20).optional();
const variant=z.object({id:z.string().regex(/^wm-\d+$/),title:z.string().max(500).optional(),url:z.string().optional(),price:z.object({amount:z.number().int().nonnegative().max(1000000000),currency:z.literal('MDL')}).optional(),availability:z.object({available:z.boolean().optional(),status:z.string()}).optional(),media}).passthrough();
const record=z.object({id:z.string().regex(/^wm-\d+$/),title:z.string().min(2).max(500),url:z.string(),variants:z.array(variant).min(1).max(30),media}).passthrough();
export const snapshot=z.object({action:z.literal('publish-acp'),updatedAt:z.string().datetime({offset:true}),digest:z.string().regex(/^sha256:[a-f0-9]{64}$/),bytes:z.number().int().positive().max(350000000),sourceCount:z.number().int().positive().max(200000),rows:z.array(record).max(1500),seconds:z.number().nonnegative().max(300)});
export function normalizeACP(input:unknown){const s=snapshot.parse(input);const age=Date.now()-Date.parse(s.updatedAt);if(age< -30000||age>86400000)throw Error('Snapshot timestamp outside retention window');const items:any[]=[],ids=new Set<string>();for(const p of s.rows){for(const v of p.variants){const title=v.title||p.title,categories=classifyMerchandise(title);if(!categories.length)continue;const id='wildmart-'+v.id;if(ids.has(id))throw Error('Duplicate merchant variant');ids.add(id);const photos=v.media|| (p.variants.length===1?p.media:[])||[];const photo=photos.find(x=>x.type==='image'&&imageUrl(x.url));items.push({id,sourceProductId:p.id,variantId:v.id,title,categories,url:productUrl(v.url||p.url),price:v.price?v.price.amount/100:null,currency:'MDL',availability:v.availability?.status==='in_stock'&&v.availability.available!==true?'unknown':v.availability?.status||'unknown',observedAt:s.updatedAt,image:photo?{url:imageUrl(photo.url),status:'pending',identity:'exact-source-variant',sourceProductId:p.id,variantId:v.id,permission:ACP_POLICY,attribution:'Wildmart merchant product feed; remote display in retailer context',method:'remote-reference'}:null});}}return {...s,items};}
export async function acpState(){const r=await db().prepare('SELECT data FROM config WHERE key=?').bind(key).first<{data:string}>();const state=JSON.parse(r?.data||'{}');return {...state,due:state.enabled!==false&&(!state.nextAt||state.nextAt<=now()),source:'Wildmart ACP',permissionUrl:ACP_POLICY};}
export async function acpFailure(message:string, expectedLastSuccess?:string|null) {
  const row=await db().prepare('SELECT data FROM config WHERE key=?').bind(key).first<{data:string}>();
  const state=JSON.parse(row?.data || '{}');
  if (state.enabled === false || (expectedLastSuccess !== undefined && (state.lastSuccess ?? null) !== expectedLastSuccess)) {
    return {skipped:true};
  }
  const failures=(state.failures || 0)+1;
  const nextAt=new Date(Date.now()+Math.min(6,failures)*3600000).toISOString();
  const data=JSON.stringify({...state,failures,lastAttempt:now(),error:message.slice(0,300),nextAt});
  const write=row ? db().prepare('UPDATE config SET data=? WHERE key=? AND data=? RETURNING key').bind(data,key,row.data)
    : db().prepare('INSERT OR IGNORE INTO config(key,data) VALUES (?,?) RETURNING key').bind(key,data);
  if (!await write.first()) return {skipped:true};
  return {failed:true,failures,nextAt};
}
export async function publishACP(input: unknown, identity: {runId: string; event: string}) {
  const snapshot = normalizeACP(input);
  const stateRow = await db().prepare('SELECT data FROM config WHERE key=?').bind(key).first<{data:string}>();
  const prior = JSON.parse(stateRow?.data || '{}');
  if (prior.enabled === false) throw Error('Merchant source suspended');
  const sourceTime = Date.parse(snapshot.updatedAt);
  if (sourceTime < Date.parse(prior.updatedAt)) throw Error('Older generation refused');
  const sameGeneration = prior.digest === snapshot.digest && sourceTime === Date.parse(prior.updatedAt);
  const at = now();
  if (sameGeneration && prior.nextAt > at && !prior.failures) return {unchanged:true, count:prior.count};

  const guard = crypto.randomUUID();
  const statements = [db().prepare("INSERT INTO catalog_write_guards(id,valid) VALUES (?,CASE WHEN COALESCE((SELECT data FROM config WHERE key=?),'')=? THEN 1 ELSE 0 END)")
    .bind(guard, key, stateRow?.data || '')];
  let added = 0, updated = 0, removed = 0;
  const images = snapshot.items.filter(item => item.image).length;
  if (!sameGeneration) {
    const existing = await db().prepare('SELECT id,data,first_seen FROM merchant_feed_items')
      .all<{id:string; data:string; first_seen:string}>();
    const old = new Map(existing.results.map(row => [row.id, row]));
    const ids = new Set(snapshot.items.map(item => item.id));
    removed = existing.results.filter(row => !ids.has(row.id)).length;
    if (removed > old.size / 2) throw Error('Unexpected feed removal above 50%; prior snapshot preserved for review');

    for (const item of snapshot.items) {
      const row = old.get(item.id);
      const previous = row ? JSON.parse(row.data) : null;
      if (previous && previous.sourceProductId === item.sourceProductId && previous.url === item.url) {
        if (Date.parse(previous.observedAt) > sourceTime) {
          item.price = previous.price;
          item.availability = previous.availability;
          item.observedAt = previous.observedAt;
        }
        if (Date.parse(previous.lastVerificationAttempt) >= sourceTime) {
          item.lastVerificationAttempt = previous.lastVerificationAttempt;
        }
        if (item.image && previous.image?.url === item.image.url && previous.image.checkedAt) {
          item.image = previous.image;
        }
      }
      if (!previous) added++;
      else if (previous.price !== item.price || previous.availability !== item.availability || previous.title !== item.title) updated++;
      // A concurrent detail or photo write must make the batch roll back instead of being overwritten.
      statements.push(db().prepare(`
        INSERT INTO merchant_feed_items(id,title,categories,data,generation,first_seen,updated_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, categories=excluded.categories,
          data=CASE WHEN merchant_feed_items.data=? THEN excluded.data ELSE NULL END,
          generation=excluded.generation, updated_at=excluded.updated_at
      `).bind(item.id,item.title,JSON.stringify(item.categories),JSON.stringify(item),snapshot.digest,row?.first_seen || at,at,row?.data ?? null));
    }
    statements.push(db().prepare('DELETE FROM merchant_feed_items WHERE generation<>?').bind(snapshot.digest));
  }
  const history = {at,runId:identity.runId,event:identity.event,added,updated,removed,count:snapshot.items.length,
    images,sourceCount:snapshot.sourceCount,bytes:snapshot.bytes,seconds:snapshot.seconds,unchanged:prior.digest === snapshot.digest};
  const next = {enabled:true,updatedAt:snapshot.updatedAt,digest:snapshot.digest,lastSuccess:at,
    nextAt:new Date(Date.parse(at)+6*3600000).toISOString(),count:history.count,failures:0,
    history:[history,...(prior.history || [])].slice(0,30)};
  statements.push(db().prepare('INSERT INTO config(key,data) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind(key,JSON.stringify(next)));
  statements.push(db().prepare('DELETE FROM catalog_write_guards WHERE id=?').bind(guard));
  await db().batch(statements);
  return history;
}
export async function maintainACP(){const state=await acpState();if(state.enabled===false)return {skipped:true};const rows=await db().prepare("SELECT id,data FROM merchant_feed_items WHERE json_extract(data,'$.image.url') IS NOT NULL AND (json_extract(data,'$.image.checkedAt') IS NULL OR json_extract(data,'$.image.checkedAt')<?) ORDER BY COALESCE(json_extract(data,'$.image.checkedAt'),''),id LIMIT 5").bind(new Date(Date.now()-7*86400000).toISOString()).all<{id:string;data:string}>();const results=[];for(const row of rows.results){const item=JSON.parse(row.data),url=imageUrl(item.image.url);let status='verification-failed',contentType='';try{if(url){const r=await fetch(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(5000)});contentType=r.headers.get('content-type')||'';status=r.ok&&/^image\/(jpeg|png|webp|gif)$/i.test(contentType.split(';')[0].trim())?'verified':r.status===404||r.status===410?'broken':'verification-failed';}}catch{}const photo={...item.image,status,contentType,checkedAt:now()};await db().prepare("UPDATE merchant_feed_items SET data=json_set(data,'$.image',json(?)) WHERE id=? AND json_extract(data,'$.image.url')=?").bind(JSON.stringify(photo),row.id,item.image.url).run();results.push({id:row.id,status});}return {checked:results.length,results};}
export async function acpOverview(){const state=await acpState();const counts=await db().prepare("SELECT COUNT(*) products,SUM(json_extract(data,'$.image.status')='verified') images,SUM(json_extract(data,'$.image.status')='pending') pending,SUM(json_extract(data,'$.image.status')='broken') broken FROM merchant_feed_items").first();return {state,counts};}
export async function setACPEnabled(enabled:boolean) {
  await db().prepare(`
    INSERT INTO config(key,data) VALUES (?,json_object('enabled',json(?)))
    ON CONFLICT(key) DO UPDATE SET data=json_set(config.data,'$.enabled',json(?))
  `).bind(key,JSON.stringify(enabled),JSON.stringify(enabled)).run();
  return {enabled};
}
// Recheck a rotating set of existing SKUs between full feed generations.
export async function acpRefreshPlan(){const s=await acpState();if(s.enabled===false)return {ids:[]};const r=await db().prepare("SELECT id FROM merchant_feed_items WHERE COALESCE(json_extract(data,'$.lastVerificationAttempt'),json_extract(data,'$.observedAt'))<? ORDER BY COALESCE(json_extract(data,'$.lastVerificationAttempt'),json_extract(data,'$.observedAt')),id LIMIT 20").bind(new Date(Date.now()-30*60000).toISOString()).all<{id:string}>();return {ids:r.results.map(x=>x.id.replace('wildmart-wm-',''))};}
export async function refreshACP(input:any, identity:{runId:string;event:string}) {
  if ((await acpState()).enabled === false) return {skipped:true};
  if (!Array.isArray(input.results) || input.results.length > 20) throw Error('Invalid refresh batch');
  let verified = 0;
  for (const result of input.results) {
    if (!/^\d+$/.test(String(result.id))) throw Error('Invalid source ID');
    const row = await db().prepare('SELECT data FROM merchant_feed_items WHERE id=?')
      .bind('wildmart-wm-'+result.id).first<{data:string}>();
    if (!row) continue;
    const old = JSON.parse(row.data), item = result.item;
    const observed = Date.parse(result.updatedAt), age = Date.now() - observed;
    const good = item?.product_id === Number(result.id) && item.data_stale === false &&
      age >= 0 && age < 1800000 && observed >= Date.parse(old.observedAt) && item.canonical_url === old.url;
    let {price, availability, observedAt} = old;
    if (good) {
      price = item.price?.currency === 'MDL' && item.price.mode === 'fixed' && /^\d+\.\d{2}$/.test(item.price.current || '') ? Number(item.price.current) : null;
      if (price !== null && (!Number.isFinite(price) || price > 10000000)) price = null;
      availability = ['in_stock','out_of_stock','preorder','backorder'].includes(item.availability) ? item.availability : 'unknown';
      observedAt = result.updatedAt;
    }
    const written = await db().prepare(`
      UPDATE merchant_feed_items SET data=json_set(data,'$.price',?,'$.availability',?,'$.observedAt',?,'$.lastVerificationAttempt',?)
      WHERE id=? AND data=? AND NOT EXISTS (SELECT 1 FROM config WHERE key=? AND json_extract(data,'$.enabled')=0)
      RETURNING id
    `).bind(price,availability,observedAt,now(),old.id,row.data,key).first();
    if (good && written) verified++;
  }
  const summary = {at:now(),runId:identity.runId,event:identity.event,attempted:input.results.length,verified};
  await db().prepare("INSERT INTO config(key,data) VALUES ('wildmart-refresh',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data").bind(JSON.stringify(summary)).run();
  return summary;
}
