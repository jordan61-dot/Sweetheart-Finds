import {db,now} from '../server';
import type {Product} from '../domain';
import {picturedWorkIds, withEditionCover} from '../open-library-covers';
const reviewablePhoto = `p.archived=0
  AND json_extract(c.data,'$.feed') IS NULL
  AND json_extract(c.data,'$.match.decision')='review'
  AND json_extract(c.data,'$.review') IS NULL
  AND json_extract(c.data,'$.candidate.url') IS NOT NULL`;

// SQL aggregation avoids exporting the catalog or leaking personal records.
export async function mediaOverview(){
 const at=now();
 const identity=`EXISTS(SELECT 1 FROM config m JOIN json_each(p.data,'$.images') image ON json_extract(image.value,'$.url')=json_extract(m.data,'$.candidate.url') WHERE m.key LIKE 'media:%' AND json_extract(m.data,'$.productId')=p.id AND (json_extract(m.data,'$.match.decision')='approved' OR json_extract(m.data,'$.review')='approved') AND (json_extract(image.value,'$.expiresAt') IS NULL OR json_extract(image.value,'$.expiresAt')>?))`;
 const metrics=await db().prepare(`SELECT COUNT(*) total,COALESCE(SUM(json_array_length(json_extract(p.data,'$.images'))>0),0) withImages,COALESCE(SUM(${identity}),0) identityAssigned FROM products p WHERE p.archived=0`).bind(at).first();
 const categories=await db().prepare(`SELECT pc.category,COUNT(*) total,SUM(json_array_length(json_extract(p.data,'$.images'))>0) withImages,SUM(${identity}) identityAssigned FROM products p JOIN product_categories pc ON pc.product_id=p.id WHERE p.archived=0 GROUP BY pc.category`).bind(at).all();
 const reviews=await db().prepare(`
   SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN ${reviewablePhoto} THEN 1 ELSE 0 END),0) awaiting,
     SUM(json_extract(c.data,'$.review')='approved') humanApproved,
     SUM(json_extract(c.data,'$.match.decision')='approved') automatic
   FROM config c LEFT JOIN products p ON p.id=json_extract(c.data,'$.productId')
   WHERE c.key >= 'media:' AND c.key < 'media;'
 `).first();
 const bookIds=JSON.stringify(picturedWorkIds);
 const audit=await db().prepare(`
   SELECT json_extract(result.value,'$.status') status,COUNT(*) total FROM config c
   JOIN products p ON c.key='image-audit:'||p.id JOIN json_each(c.data,'$.results') result
   WHERE p.archived=0 AND p.id NOT IN (SELECT value FROM json_each(?))
   AND EXISTS(SELECT 1 FROM json_each(p.data,'$.images') i WHERE json_extract(i.value,'$.url')=json_extract(result.value,'$.url'))
   GROUP BY json_extract(result.value,'$.status')
 `).bind(bookIds).all<{status:string;total:number}>();
 const books=await db().prepare(`
   SELECT p.data,c.data AS audit FROM products p LEFT JOIN config c ON c.key='image-audit:'||p.id
   WHERE p.archived=0 AND p.id IN (SELECT value FROM json_each(?))
 `).bind(bookIds).all<{data:string;audit:string|null}>();
 const auditCounts=new Map(audit.results.map(row=>[row.status,row.total]));
 for(const row of books.results){
   if(!row.audit)continue;
   const gallery=withEditionCover(JSON.parse(row.data)).images;
   for(const result of JSON.parse(row.audit).results||[]){
     if(gallery.some(image=>image.url===result.url))
       auditCounts.set(result.status,(auditCounts.get(result.status)||0)+1);
   }
 }
 const picturedEditions=books.results.filter(row=>{
   const product:Product=JSON.parse(row.data);
   return withEditionCover(product).images.some((image,index)=>
     image!==product.images[index] && (!image.expiresAt || Date.parse(image.expiresAt)>Date.parse(at)));
 }).length;
 return {metrics:{...metrics,picturedEditions},categories:categories.results,reviews,audit:[...auditCounts].map(([status,total])=>({status,total})),at};
}

export async function mediaReviewPage(filter: 'pending' | 'all', after = '') {
  if (after && (!after.startsWith('media:') || after.length > 400)) {
    throw Error('Invalid photo review cursor');
  }
  const pageSize = 20;
  const pending = filter === 'pending' ? 'AND ' + reviewablePhoto : '';
  const rows = await db().prepare(`
    SELECT c.key,c.data,p.title,COALESCE(p.archived=0,0) AS active
    FROM config c
    LEFT JOIN products p ON p.id=json_extract(c.data,'$.productId')
    WHERE c.key >= 'media:' AND c.key < 'media;' AND c.key > ? ${pending}
    ORDER BY c.key LIMIT ?
  `).bind(after,pageSize + 1).all<{key:string;data:string;title:string|null;active:number}>();
  const page = rows.results.slice(0,pageSize);
  return {
    entries:page.map(row=>({...JSON.parse(row.data),key:row.key,productTitle:row.title,active:!!row.active})),
    next:rows.results.length > pageSize ? page.at(-1)!.key : null
  };
}
