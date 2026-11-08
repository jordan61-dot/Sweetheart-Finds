import {auth,body,db,apiError,now} from '../../../lib/server';
import {searchWildmart,wildmartRequest} from '../../../lib/discovery/wildmart';
// Only counters/cooldowns are durable. Product responses, queries and cursors never enter D1.
export async function POST(request:Request){try{
 await auth(request);const input=wildmartRequest.parse(await body(request)),at=now();
 const cooldown=await db().prepare("SELECT data FROM config WHERE key='cooldown:wildmart'").first<{data:string}>();if(cooldown&&Number(cooldown.data)>Date.now())throw Object.assign(Error('Retailer is cooling down; try again later.'),{status:429});
 const minute=await db().prepare("INSERT INTO config(key,data) VALUES ('rate:wildmart',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data WHERE CAST(config.data AS INTEGER)<=? RETURNING data").bind(String(Date.now()),Date.now()-3000).first();if(!minute)throw Object.assign(Error('Please wait three seconds between retailer searches.'),{status:429});
 const budget=await db().prepare("INSERT INTO config(key,data) VALUES (?,'1') ON CONFLICT(key) DO UPDATE SET data=CAST(CAST(config.data AS INTEGER)+1 AS TEXT) WHERE CAST(config.data AS INTEGER)<200 RETURNING data").bind('budget:wildmart:'+at.slice(0,10)).first();if(!budget)throw Object.assign(Error('Today’s free retailer search budget is used. Try tomorrow.'),{status:429});
 try{return Response.json(await searchWildmart(input),{headers:{'Cache-Control':'no-store, max-age=0','Pragma':'no-cache'}});}catch(e){if((e as any).status===429|| (e as any).status===502)await db().prepare("INSERT INTO config(key,data) VALUES ('cooldown:wildmart',?) ON CONFLICT(key) DO UPDATE SET data=excluded.data").bind(String(Date.now()+Math.min(86400,Math.max(60,Number((e as any).retryAfter)||60))*1000)).run();throw e;}
 }catch(e){const response=apiError(e);response.headers.set('Cache-Control','no-store');return response;}}
