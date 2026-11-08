import {z} from 'zod';
import {classifyMerchandise} from './intelligence.ts';
import {publicUrl} from './feed.ts';
import {retryAfterSeconds} from './transport.ts';
export const wildmartRequest=z.object({query:z.string().trim().min(2).max(120),cursor:z.string().max(1100).optional()}).strict();
export type ShopperOffer={id:string;title:string;url:string;brand:string;price:number|null;currency:'MDL';availability:string;categories:string[];sourceUpdatedAt:string;variants:number[]};
export type ShopperResults={items:ShopperOffer[];nextCursor:string|null;at:string;expiresAt:string;sourceUpdatedAt:string;source:'Wildmart';shipping:string;omitted:number};
const endpoint='https://wildmart.md/api/public/v1/products';
export function normalizeWildmart(raw:any,at=new Date().toISOString()):ShopperResults{
 if(!raw||!Array.isArray(raw.items)||raw.items.length>20||!Number.isFinite(Date.parse(raw.data_updated_at)))throw Error('Retailer response format changed');
 const current=Date.parse(at),projection=Date.parse(raw.data_updated_at),projectionFresh=projection<=current+30000&&projection>=current-3600000;
 const items:ShopperOffer[]=[],seen=new Set<string>();
 for(const p of raw.items){if(!p||!Number.isSafeInteger(p.product_id)||p.product_id<=0||typeof p.name!=='string'||p.name.length>500)continue;
  const categories=classifyMerchandise(p.name,typeof p.brand?.name==='string'?p.brand.name:'');if(!categories.length)continue;
  let url:URL;try{url=publicUrl(p.canonical_url);if(url.hostname!=='wildmart.md'||!/^\/(ro|ru)\/product\//.test(url.pathname))continue;}catch{continue;}
  const id=String(p.product_id);if(seen.has(id))continue;seen.add(id);
  const fresh=projectionFresh&&p.data_stale===false;const numeric=fresh&&p.price?.currency==='MDL'&&p.price?.mode==='fixed'&&/^\d+\.\d{2}$/.test(p.price.current||'')?Number(p.price.current):null;
  items.push({id,title:p.name,url:url.toString(),brand:typeof p.brand?.name==='string'?p.brand.name.slice(0,120):'Unknown',price:numeric!==null&&Number.isFinite(numeric)&&numeric<=10000000?numeric:null,currency:'MDL',availability:fresh&&['in_stock','out_of_stock','preorder','backorder'].includes(p.availability)?p.availability:'unknown',categories,sourceUpdatedAt:raw.data_updated_at,variants:Array.isArray(p.variant_product_ids)?p.variant_product_ids.filter((n:unknown)=>Number.isSafeInteger(n)&&Number(n)>0).slice(0,20):[]});
 }
 return {items,nextCursor:typeof raw.next_cursor==='string'&&raw.next_cursor.length<=1100?raw.next_cursor:null,at,expiresAt:new Date(current+60000).toISOString(),sourceUpdatedAt:raw.data_updated_at,source:'Wildmart',shipping:'Retailer documents delivery within Moldova. US shipping is not established.',omitted:raw.items.length-items.length};
}
export async function searchWildmart(input:unknown,fetcher:typeof fetch=fetch){
 const {query,cursor}=wildmartRequest.parse(input),url=new URL(endpoint);url.search=new URLSearchParams({q:query,lang:'ro',limit:'12',...(cursor?{cursor}: {})}).toString();
 const response=await fetcher(url.toString(),{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','User-Agent':'SweetheartFinds/2.3 (+https://sweetheart-finds.jordanmullens12.chatgpt.site; shopper-triggered discovery)'}});
 if(!response.ok)throw Object.assign(Error(response.status===410?'Retailer pagination expired. Start a new search.':response.status===429?'Retailer rate limit reached. Try again later.':'Retailer temporarily unavailable (HTTP '+response.status+').'),{status:response.status===410?410:response.status===429?429:502,retryAfter:Math.max(60,retryAfterSeconds(response.headers.get('retry-after')))});
 const reader=response.body?.getReader();if(!reader)throw Error('Empty retailer response');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>524288)throw Error('Retailer response exceeds safety limit');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 return normalizeWildmart(JSON.parse(new TextDecoder().decode(bytes)));
}
