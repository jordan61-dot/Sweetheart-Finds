import {db,now} from '../server';
// SQL aggregation avoids exporting the catalog or leaking personal records.
export async function mediaOverview(){
 const at=now();
 const identity=`EXISTS(SELECT 1 FROM config m JOIN json_each(p.data,'$.images') image ON json_extract(image.value,'$.url')=json_extract(m.data,'$.candidate.url') WHERE m.key LIKE 'media:%' AND json_extract(m.data,'$.productId')=p.id AND (json_extract(m.data,'$.match.decision')='approved' OR json_extract(m.data,'$.review')='approved') AND (json_extract(image.value,'$.expiresAt') IS NULL OR json_extract(image.value,'$.expiresAt')>?))`;
 const metrics=await db().prepare(`SELECT COUNT(*) total,COALESCE(SUM(json_array_length(json_extract(p.data,'$.images'))>0),0) withImages,COALESCE(SUM(${identity}),0) identityAssigned FROM products p WHERE p.archived=0`).bind(at).first();
 const categories=await db().prepare(`SELECT pc.category,COUNT(*) total,SUM(json_array_length(json_extract(p.data,'$.images'))>0) withImages,SUM(${identity}) identityAssigned FROM products p JOIN product_categories pc ON pc.product_id=p.id WHERE p.archived=0 GROUP BY pc.category`).bind(at).all();
 const reviews=await db().prepare("SELECT COUNT(*) total,SUM(json_extract(data,'$.match.decision')='review' AND json_extract(data,'$.review') IS NULL) awaiting,SUM(json_extract(data,'$.review')='approved') humanApproved,SUM(json_extract(data,'$.match.decision')='approved') automatic FROM config WHERE key LIKE 'media:%'").first();
 const audit=await db().prepare("SELECT json_extract(result.value,'$.status') status,COUNT(*) total FROM config c JOIN products p ON c.key='image-audit:'||p.id JOIN json_each(c.data,'$.results') result WHERE p.archived=0 AND EXISTS(SELECT 1 FROM json_each(p.data,'$.images') i WHERE json_extract(i.value,'$.url')=json_extract(result.value,'$.url')) GROUP BY json_extract(result.value,'$.status')").all();
 return {metrics,categories:categories.results,reviews,audit:audit.results,at};
}
