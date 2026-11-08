import type {Product} from '../domain.ts';
import {publicUrl} from './feed.ts';
export type ImageCandidate={url:string;sourceUrl:string;sourceProduct?:string;sourceVariant?:string;identifiers:Record<string,string>;title:string;brand?:string;generation?:string;year?:number;license:string;licenseUrl:string;attribution:string;expiresAt?:string;verifiedAt?:string;contentType?:string;};
const norm=(v:string)=>v.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function matchImage(p:Product,c:ImageCandidate,at=Date.now()){
 const reasons:string[]=[];const reject=(reason:string)=>({decision:'rejected' as const,score:0,reasons:[reason]});
 try{publicUrl(c.url);publicUrl(c.sourceUrl);publicUrl(c.licenseUrl);}catch{return reject('Unsafe image or evidence URL');}
 if(!['CC0','CC-BY','CC-BY-SA','owner-permitted','source-api'].includes(c.license)||!c.attribution)return reject('Missing permission or attribution');
 if(c.expiresAt&&Date.parse(c.expiresAt)<=at)return reject('Image permission expired');
 const evidence=['gtin','upc','ean','sku','petNumber','model','color','size','edition'];
 for(const key of evidence)if(p.identifiers[key]&&c.identifiers[key]&&norm(p.identifiers[key])!==norm(c.identifiers[key]))return reject('Conflicting '+key);
 if(p.generation&&c.generation&&norm(p.generation)!==norm(c.generation))return reject('Conflicting generation');
 if(p.year&&c.year&&p.year!==c.year)return reject('Conflicting release year');
 if(p.brand!=='Unknown'&&c.brand&&norm(p.brand)!==norm(c.brand))return reject('Conflicting brand');
 const sameSource=new URL(p.sourceUrl).hostname===new URL(c.sourceUrl).hostname;
 const exactSource=sameSource&&!!p.identifiers.sourceProduct&&c.sourceProduct===p.identifiers.sourceProduct;
 const exactGlobal=['gtin','upc','ean'].some(k=>!!p.identifiers[k]&&p.identifiers[k]===c.identifiers[k]);
 const exactSku=p.brand!=='Unknown'&&!!c.brand&&norm(c.brand)===norm(p.brand)&&!!p.identifiers.sku&&p.identifiers.sku===c.identifiers.sku;
 const variant=p.identifiers.sourceVariant||'';
 if(variant&&c.sourceVariant&&variant!==c.sourceVariant)return reject('Conflicting source variant');
 const missingVariant=(variant&&c.sourceVariant!==variant)||['color','size','edition','petNumber'].some(k=>p.identifiers[k]&&!c.identifiers[k])||(p.variants.length>0&&!variant);
 const verified=!!c.verifiedAt&&at-Date.parse(c.verifiedAt)>=0&&at-Date.parse(c.verifiedAt)<86400000&&/^image\/(jpeg|png|webp|gif|avif)$/.test(c.contentType||'');
 if((exactSource||exactGlobal||exactSku)&&!missingVariant&&verified){reasons.push(exactSource?'Exact source product and variant':exactGlobal?'Exact global identifier':'Exact brand and SKU');return {decision:'approved' as const,score:100,reasons};}
 if(exactSource||exactGlobal||exactSku)reasons.push(missingVariant?'Variant evidence incomplete':'Image availability needs verification');
 else reasons.push(norm(p.title)===norm(c.title)?'Title agreement alone cannot establish exact identity':'No exact product identifier');
 return {decision:'review' as const,score:exactSource||exactGlobal||exactSku?85:30,reasons};
}
