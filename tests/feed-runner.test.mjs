import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import {registerHooks} from 'node:module';
globalThis.testFeedEnv={};
registerHooks({resolve(specifier,context,next){if(specifier==='cloudflare:workers')return {url:'test:cloudflare',shortCircuit:true};if(specifier.endsWith('/app/chatgpt-auth'))return {url:'test:auth',shortCircuit:true};if(specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier))specifier+='.ts';return next(specifier,context);},load(url,context,next){if(url==='test:cloudflare')return {format:'module',source:'export const env=globalThis.testFeedEnv;',shortCircuit:true};if(url==='test:auth')return {format:'module',source:'export async function getChatGPTUser(){return null;}',shortCircuit:true};if(url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};return next(url,context);}});
const {saveFeed,runFeed,resetFeed,authenticateCollector}=await import('../lib/discovery/feed-runner.ts');
const {catalogRevision,catalogBatch}=await import('../lib/server.ts');
const feed={id:'fixture-feed',name:'Fixture merchant',url:'https://merchant.example/feed',format:'json',enabled:true,intervalHours:6,permissionUrl:'https://merchant.example/permission',permissionNote:'Fixture permission for tests only. Not a real authorized merchant.',recurringAllowed:true,durableAllowed:true,imagesAllowed:true,imageHosts:['images.example'],permissionExpiresAt:'2030-01-01T00:00:00Z',mapping:{}};
const row={sourceId:'abc',title:'My Melody plush',categories:['my-melody'],url:'https://merchant.example/item',price:25,currency:'USD',availability:'available',images:[{url:'https://images.example/photo.jpg',sourceId:'abc',attribution:'Fixture creator'}]};
function setup(){const sql=new DatabaseSync(':memory:');for(const file of ['0000_easy_red_shift.sql','0001_discovery_foundation.sql','0002_current_merchant_feed.sql'])sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));const database={prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {success:true,results:sql.prepare(query).all(...args)};},async run(){return {success:true,...sql.prepare(query).run(...args)};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.all());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};Object.assign(globalThis.testFeedEnv,{DB:database,FEED_ALLOWED_HOSTS:'merchant.example',FEED_IMAGE_ALLOWED_HOSTS:'images.example',SWEETHEART_COLLECTOR_TOKEN:'x'.repeat(40)});return sql;}
function fetchFixture(rows=[row]){globalThis.fetch=async(url,options)=>options?.method==='HEAD'?new Response(null,{headers:{'content-type':'image/jpeg'}}):Response.json(rows,{headers:{etag:'fixture-etag'}});}
test('real SQLite feed pipeline publishes product offer image and FTS, repeat run is idempotent',async()=>{const sql=setup();fetchFixture();await saveFeed(feed);const first=await runFeed(feed.id,true);assert.equal(first.records,1);assert.equal(first.imagesAssigned,1);assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM product_search WHERE product_search MATCH ?').get('melody').n,1);await resetFeed(feed.id);fetchFixture([{...row,price:17}]);await runFeed(feed.id);assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,1);assert.equal(sql.prepare('SELECT price_micros FROM listings').get().price_micros,17000000);assert.equal(sql.prepare('SELECT count(*) n FROM observations').get().n,2);});
test('failed source leaves the catalog intact and records recoverable failure',async()=>{const sql=setup();fetchFixture();await saveFeed(feed);await runFeed(feed.id);const old=sql.prepare('SELECT data FROM products').get().data;await resetFeed(feed.id);globalThis.fetch=async()=>new Response(null,{status:503});await assert.rejects(runFeed(feed.id),/503/);assert.equal(sql.prepare('SELECT data FROM products').get().data,old);const state=JSON.parse(sql.prepare("SELECT data FROM config WHERE key='feed-state:fixture-feed'").get().data);assert.equal(state.failures,1);assert.ok(state.nextAt);});
test('checkpoint resumes without another feed request or duplicate products',async()=>{const sql=setup();fetchFixture(Array.from({length:11},(_,i)=>({...row,sourceId:'item'+i,images:[]})));await saveFeed(feed);assert.equal((await runFeed(feed.id)).complete,false);assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,10);await resetFeed(feed.id);globalThis.fetch=async()=>{throw Error('checkpoint must not fetch');};assert.equal((await runFeed(feed.id)).complete,true);assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,11);});
test('active lease excludes concurrent collection and owner edits force transaction rollback',async()=>{const sql=setup();await saveFeed(feed);let finish;globalThis.fetch=async()=>new Promise(r=>finish=r);const running=runFeed(feed.id);while(!finish)await new Promise(r=>setImmediate(r));assert.equal((await runFeed(feed.id)).skipped,true);finish(Response.json([{...row,images:[]}]));await running;const revision=await catalogRevision();await catalogBatch([],revision);await assert.rejects(catalogBatch([],revision),/Catalog changed/);assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,1);});
test('service authentication rejects missing or wrong credentials',async()=>{setup();await assert.rejects(authenticateCollector(new Request('https://site.example/tick')),/Unauthorized/);await authenticateCollector(new Request('https://site.example/tick',{headers:{authorization:'Bearer '+'x'.repeat(40)}}));});
const {backfillNext,reviewMedia}=await import('../lib/discovery/media-backfill.ts');
const {auditNextImage,maintenanceTick,imageHead}=await import('../lib/discovery/maintenance.ts');
test('photo backfill upgrades the cursor and discovers newer products that sort earlier',async()=>{
 const sql=setup();fetchFixture([{...row,sourceId:'z',images:[]},{...row,sourceId:'a',images:[]}]);await saveFeed(feed);await runFeed(feed.id);
 const products=sql.prepare('SELECT id FROM products ORDER BY id').all();const oldAt='2026-01-01T00:00:00.000Z';
 sql.prepare('UPDATE products SET added_at=? WHERE id=?').run('2025-01-01T00:00:00.000Z',products[1].id);
 sql.prepare('INSERT INTO config(key,data) VALUES (?,?)').run('media-backfill',JSON.stringify({after:products[1].id,lastAt:oldAt,processed:1,complete:true}));
 let requests=0;globalThis.fetch=async()=>{requests++;return Response.json({query:{pages:{}}});};
 assert.equal((await backfillNext()).complete,false);assert.equal(requests,1);assert.equal(sql.prepare("SELECT count(*) n FROM config WHERE key LIKE 'media-scanned:%'").get().n,2);
 assert.equal((await backfillNext()).complete,true);assert.equal(requests,1);
});
test('image audits checkpoint every gallery image and notice changed galleries',async()=>{
 const sql=setup();fetchFixture();await saveFeed(feed);await runFeed(feed.id);const p=JSON.parse(sql.prepare('SELECT data FROM products').get().data);
 p.images=Array.from({length:5},(_,i)=>({...p.images[0],url:'https://images.example/'+i+'.jpg'}));sql.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(p),p.id);
 let requests=0;globalThis.fetch=async(_url,options)=>{assert.equal(options.redirect,'manual');requests++;return new Response(null,{headers:{'content-type':'image/jpeg'}});};
 assert.equal((await auditNextImage()).complete,false);assert.equal(requests,3);assert.equal((await auditNextImage()).complete,true);assert.equal(requests,5);assert.equal((await auditNextImage()).checked,0);
 p.images[4].url='https://images.example/replacement.jpg';sql.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(p),p.id);assert.equal((await auditNextImage()).complete,false);assert.equal(requests,8);
});
test('photo approval cannot overwrite a concurrent owner rejection',async()=>{
 const sql=setup();fetchFixture();await saveFeed(feed);await runFeed(feed.id);const p=JSON.parse(sql.prepare('SELECT data FROM products').get().data);const key='media:'+p.id+':commons:1';
 const media={productId:p.id,match:{decision:'review'},candidate:{url:'https://upload.wikimedia.org/test.jpg',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',license:'CC-BY',attribution:'Fixture creator',sourceUrl:'https://commons.wikimedia.org/wiki/File:Test',expiresAt:'2030-01-01T00:00:00Z'}};
 sql.prepare('INSERT INTO config(key,data) VALUES (?,?)').run(key,JSON.stringify(media));let finish;globalThis.fetch=async()=>new Promise(r=>finish=r);const approving=reviewMedia(key,true);while(!finish)await new Promise(r=>setImmediate(r));await reviewMedia(key,false);finish(new Response(null,{headers:{'content-type':'image/jpeg'}}));await assert.rejects(approving);
 assert.equal(JSON.parse(sql.prepare('SELECT data FROM config WHERE key=?').get(key).data).review,'rejected');assert.equal(JSON.parse(sql.prepare('SELECT data FROM products').get().data).images.length,1);
});
test('maintenance records a real database history and excludes overlapping ticks',async()=>{
 const sql=setup();fetchFixture([{...row,images:[]}]);await saveFeed(feed);let finish;globalThis.fetch=async()=>new Promise(r=>finish=r);const identity={event:'schedule',runId:'123',attempt:'1'};const running=maintenanceTick(identity);while(!finish)await new Promise(r=>setImmediate(r));assert.equal((await maintenanceTick(identity)).skipped,true);
 const resolve=finish;globalThis.fetch=async()=>Response.json({query:{pages:{}}});resolve(Response.json([{...row,images:[]}]));const result=await running;assert.equal(result.errors.length,0);const state=JSON.parse(sql.prepare("SELECT data FROM config WHERE key='automation-runtime'").get().data);assert.equal(state.lastScheduledAt,result.at);assert.equal(state.runs.length,1);assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,1);
});

test('image redirects are bounded and confined to the approved HTTPS origin',async()=>{
 let calls=[];globalThis.fetch=async(url)=>{calls.push(url);return calls.length===1?new Response(null,{status:302,headers:{location:'/resolved.jpg'}}):new Response(null,{headers:{'content-type':'image/jpeg'}});};
 assert.equal((await imageHead('https://covers.openlibrary.org/start.jpg')).status,200);assert.equal(calls[1],'https://covers.openlibrary.org/resolved.jpg');
 calls=[];globalThis.fetch=async(url)=>{calls.push(url);return new Response(null,{status:302,headers:{location:'https://unapproved.example/image.jpg'}});};assert.equal((await imageHead('https://covers.openlibrary.org/start.jpg')).status,302);assert.equal(calls.length,1);
 calls=[];globalThis.fetch=async(url)=>{calls.push(url);return new Response(null,{status:302,headers:{location:'/loop.jpg'}});};assert.equal((await imageHead('https://covers.openlibrary.org/start.jpg')).status,302);assert.equal(calls.length,3);
});
const {mediaOverview}=await import('../lib/discovery/media-overview.ts');
test('edition cover coverage counts current displayed book editions independently of collectible-photo assignments',async()=>{
  const sql=setup(), {productStatements}=await import('../lib/server.ts'), {normalizeProduct}=await import('../lib/domain.ts');
  const catalog=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
  const book=normalizeProduct(catalog.find(p=>p.id==='openlibrary-OL17400503W'));
  await catalogBatch(productStatements(book),await catalogRevision());
  let {metrics}=await mediaOverview();
  assert.equal(metrics.picturedEditions,1);
  assert.equal(metrics.identityAssigned,0);
  for(const expiresAt of ['2020-01-01T00:00:00Z','2040-01-01T00:00:00Z']){
    sql.prepare("UPDATE products SET data=json_set(data,'$.images[0].expiresAt',?) WHERE id=?").run(expiresAt,book.id);
    assert.equal((await mediaOverview()).metrics.picturedEditions,Date.parse(expiresAt)>Date.now()?1:0);
  }
  sql.prepare('UPDATE products SET archived=1 WHERE id=?').run(book.id);
  assert.equal((await mediaOverview()).metrics.picturedEditions,0);
});
test('media metrics distinguish image URLs from exact approved assignments',async()=>{const sql=setup();fetchFixture();await saveFeed(feed);await runFeed(feed.id);const stats=await mediaOverview();assert.equal(stats.metrics.total,1);assert.equal(stats.metrics.withImages,1);assert.equal(stats.metrics.identityAssigned,1);sql.prepare("DELETE FROM config WHERE key LIKE 'media:%'").run();assert.equal((await mediaOverview()).metrics.identityAssigned,0);});
test('isolated feed failures mark maintenance unsuccessful without losing history',async()=>{const sql=setup();await saveFeed(feed);globalThis.fetch=async()=>new Response(null,{status:503});const run=await maintenanceTick({event:'schedule',runId:'456',attempt:'1'});assert.ok(run.errors.some(e=>e.includes('Feed fixture-feed')));const state=JSON.parse(sql.prepare("SELECT data FROM config WHERE key='automation-runtime'").get().data);assert.equal(state.lastSuccessfulAt,undefined);assert.equal(state.lastRun.runId,'456');});

test('image audit counts group by check outcome rather than product status',async()=>{const sql=setup();fetchFixture();await saveFeed(feed);await runFeed(feed.id);const product=sql.prepare('SELECT id,data FROM products').get();const data=JSON.parse(product.data);data.images=['reachable','broken','verification-failed'].map((status,i)=>({...data.images[0],url:'https://images.example/'+i+'.jpg'}));sql.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify(data),product.id);sql.prepare('INSERT INTO config(key,data) VALUES (?,?)').run('image-audit:'+product.id,JSON.stringify({results:[...data.images.map((image,i)=>({url:image.url,status:['reachable','broken','verification-failed'][i]})),{url:'https://images.example/removed.jpg',status:'broken'}]}));const overview=await mediaOverview();assert.deepEqual(Object.fromEntries(overview.audit.map(x=>[x.status,x.total])),{broken:1,reachable:1,'verification-failed':1});});

const {publishACP,acpState,normalizeACP,maintainACP}=await import('../lib/discovery/acp.ts');
const acpFixture=()=>({action:'publish-acp',updatedAt:new Date().toISOString(),digest:'sha256:'+'a'.repeat(64),bytes:100,sourceCount:1,seconds:1,rows:[{id:'wm-123',title:'Hello Kitty plush',url:'https://wildmart.md/ro/product/kitty',variants:[{id:'wm-123',price:{amount:12345,currency:'MDL'},availability:{available:true,status:'in_stock'}}],media:[{type:'image',url:'https://wildmart.md/image/kitty.jpg'}]}]});
test('ACP snapshot persists exact variant, MDL price, FTS and idempotence',async()=>{const sql=setup(),s=acpFixture();assert.equal((await publishACP(s,{runId:'1',event:'schedule'})).added,1);assert.equal((await publishACP(s,{runId:'2',event:'schedule'})).unchanged,true);const p=JSON.parse(sql.prepare('SELECT data FROM merchant_feed_items').get().data);assert.equal(p.price,123.45);assert.equal(p.image.variantId,'wm-123');assert.equal(sql.prepare("SELECT COUNT(*) n FROM merchant_feed_search WHERE merchant_feed_search MATCH 'kitty'").get().n,1);assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,0);assert.equal((await acpState()).history.length,1);});
test('ACP rejects duplicate variants, stale generations, unsafe links and mass removal',async()=>{setup();const s=acpFixture();assert.throws(()=>normalizeACP({...s,rows:[...s.rows,...s.rows]}),/Duplicate/);assert.throws(()=>normalizeACP({...s,rows:[{...s.rows[0],url:'https://evil.example/item'}]}),/Invalid/);await publishACP(s,{runId:'1',event:'schedule'});await assert.rejects(publishACP({...s,digest:'sha256:'+'b'.repeat(64),rows:[]},{runId:'2',event:'schedule'}),/removal/);assert.equal((await acpState()).count,1);});
test('ACP photos publish only exact source variant after valid image response',async()=>{const sql=setup();await publishACP(acpFixture(),{runId:'1',event:'schedule'});globalThis.fetch=async()=>new Response(null,{headers:{'content-type':'image/jpeg'}});assert.equal((await maintainACP()).results[0].status,'verified');const p=JSON.parse(sql.prepare('SELECT data FROM merchant_feed_items').get().data);assert.equal(p.image.status,'verified');assert.equal(p.image.identity,'exact-source-variant');});
test('ACP replacement removes omitted variants and their FTS entries, preserving stable identities',async()=>{const sql=setup(),s=acpFixture();s.rows.push({...s.rows[0],id:'wm-124',title:'Monster High doll',variants:[{...s.rows[0].variants[0],id:'wm-124'}]});await publishACP(s,{runId:'1',event:'schedule'});const first=sql.prepare("SELECT first_seen FROM merchant_feed_items WHERE id='wildmart-wm-123'").get().first_seen;await publishACP({...s,digest:'sha256:'+'b'.repeat(64),rows:s.rows.slice(0,1)},{runId:'2',event:'schedule'});assert.equal(sql.prepare('SELECT COUNT(*) n FROM merchant_feed_items').get().n,1);assert.equal(sql.prepare("SELECT COUNT(*) n FROM merchant_feed_search WHERE merchant_feed_search MATCH 'monster'").get().n,0);assert.equal(sql.prepare('SELECT first_seen FROM merchant_feed_items').get().first_seen,first);assert.throws(()=>normalizeACP({...s,updatedAt:'2020-01-01T00:00:00Z'}),/timestamp/);});
const {acpRefreshPlan,refreshACP}=await import('../lib/discovery/acp.ts');
test('scheduled SKU refresh updates price and stock while failed lookups preserve prior observations',async()=>{const sql=setup();await publishACP(acpFixture(),{runId:'1',event:'schedule'});const item={product_id:123,data_stale:false,canonical_url:'https://wildmart.md/ro/product/kitty',price:{currency:'MDL',mode:'fixed',current:'99.00'},availability:'out_of_stock'};assert.equal((await refreshACP({results:[{id:'123',updatedAt:new Date().toISOString(),item}]},{runId:'2',event:'schedule'})).verified,1);let p=JSON.parse(sql.prepare('SELECT data FROM merchant_feed_items').get().data);assert.equal(p.price,99);assert.equal(p.availability,'out_of_stock');assert.deepEqual((await acpRefreshPlan()).ids,[]);await refreshACP({results:[{id:'123',error:'HTTPError'}]},{runId:'3',event:'schedule'});p=JSON.parse(sql.prepare('SELECT data FROM merchant_feed_items').get().data);assert.equal(p.price,99);assert.equal(p.availability,'out_of_stock');});

test('a due, unchanged full feed clears an outage and advances the schedule without refreshing stock', async () => {
  const sql = setup();
  const snapshot = {...acpFixture(), updatedAt: new Date(Date.now() - 3600000).toISOString()};
  const run = {runId: '1', event: 'schedule'};
  await publishACP(snapshot, run);
  sql.prepare("UPDATE config SET data=json_set(data,'$.nextAt','2020-01-01T00:00:00Z','$.failures',2,'$.error','offline') WHERE key='wildmart-acp'").run();
  const before = sql.prepare('SELECT * FROM merchant_feed_items').get();
  const result = await publishACP(snapshot, {...run, runId: '2'});
  const state = await acpState();
  assert.equal(result.unchanged, true);
  assert.equal(state.due, false);
  assert.equal(state.failures, 0);
  assert.ok(!state.error);
  assert.equal(state.history[0].runId, '2');
  assert.deepEqual(sql.prepare('SELECT * FROM merchant_feed_items').get(), before);
  await publishACP(snapshot, run);
  assert.equal((await acpState()).history.length, 2);
});

test('mass replacement is measured by lost identities even if the total stays constant', async () => {
  const sql = setup();
  const snapshot = acpFixture();
  await publishACP(snapshot, {runId:'1', event:'schedule'});
  const row = snapshot.rows[0];
  const newRow = {...row, id:'wm-999', variants:[{...row.variants[0],id:'wm-999'}]};
  await assert.rejects(publishACP({...snapshot, rows:[newRow], digest:'sha256:'+'b'.repeat(64)},
    {runId:'2',event:'schedule'}), /removal/i);
  assert.equal(sql.prepare('SELECT id FROM merchant_feed_items').get().id, 'wildmart-wm-123');
});

test('late snapshots and detail responses preserve a newer price and photo checkpoint', async () => {
  const sql = setup();
  const base = Date.now();
  const snapshot = {...acpFixture(), updatedAt:new Date(base-600000).toISOString()};
  const run = {runId:'1',event:'schedule'};
  await publishACP(snapshot, run);
  globalThis.fetch = async () => new Response(null,{status:404});
  await maintainACP();
  const recent = new Date(base-60000).toISOString();
  const item = {product_id:123, data_stale:false, canonical_url:snapshot.rows[0].url,
    price:{currency:'MDL',mode:'fixed',current:'99.00'}, availability:'out_of_stock'};
  await refreshACP({results:[{id:'123',updatedAt:recent,item}]},run);
  await publishACP({...snapshot, updatedAt:new Date(base-300000).toISOString(), digest:'sha256:'+'b'.repeat(64)},run);
  const stale = await refreshACP({results:[{id:'123',updatedAt:snapshot.updatedAt,item}]},run);
  assert.equal(stale.verified,0);
  const saved = JSON.parse(sql.prepare('SELECT data FROM merchant_feed_items').get().data);
  assert.equal(saved.price,99);
  assert.equal(saved.availability,'out_of_stock');
  assert.equal(saved.observedAt,recent);
  assert.equal(saved.image.status,'broken');
  assert.equal((await maintainACP()).checked,0);
});

test('merchant fractional pagination returns a usable whole page', async () => {
  setup();
  await publishACP(acpFixture(), {runId:'1',event:'schedule'});
  const {GET} = await import('../app/api/merchant-feed/route.ts');
  const response = await GET(new Request('https://site.example/api/merchant-feed?page=1.1'));
  assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.page,1);
  assert.equal(data.items.length,1);
});

test('bookmarks distinguish omitted offers from an aged or suspended feed', async () => {
  const sql=setup(), run={runId:'1',event:'schedule'}, snapshot=acpFixture();
  await publishACP(snapshot,run);
  const {GET} = await import('../app/api/merchant-feed/route.ts');
  const ids=['wildmart-wm-123','wildmart-wm-999'];
  const lookup=async()=>await (await GET(new Request('https://site.example/api/merchant-feed?ids='+ids.join(',')))).json();
  const current=await lookup();
  assert.deepEqual(current.unconfirmedIds,[]);
  assert.equal(current.items.length,1);
  sql.prepare("UPDATE merchant_feed_items SET updated_at='2000-01-01T00:00:00Z'").run();
  assert.deepEqual((await lookup()).unconfirmedIds,[ids[0]]);
  sql.prepare("UPDATE config SET data=json_set(data,'$.lastSuccess','2000-01-01T00:00:00Z') WHERE key='wildmart-acp'").run();
  assert.deepEqual((await lookup()).unconfirmedIds,ids);
  sql.prepare("UPDATE config SET data=json_set(data,'$.enabled',json('false')) WHERE key='wildmart-acp'").run();
  const suspended=await lookup();
  assert.deepEqual(suspended.items,[]);
  assert.deepEqual(suspended.unconfirmedIds,ids);
});

test('snapshot rolls back if a concurrent photo check changed an item', async () => {
  const sql=setup(), snapshot=acpFixture(), run={runId:'1',event:'schedule'};
  await publishACP(snapshot,run);
  const database=globalThis.testFeedEnv.DB;
  const batch=database.batch.bind(database);
  database.batch=async statements=>{
    sql.prepare("UPDATE merchant_feed_items SET data=json_set(data,'$.image.status','verified')").run();
    return batch(statements);
  };
  await assert.rejects(publishACP({...snapshot,digest:'sha256:'+'e'.repeat(64)},run));
  const {generation,data}=sql.prepare('SELECT generation,data FROM merchant_feed_items').get();
  assert.equal(generation,snapshot.digest);
  assert.equal(JSON.parse(data).image.status,'verified');
  assert.equal((await acpState()).history.length,1);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM catalog_write_guards').get().n,0);
});

test('a missed refresh write cannot count as a verified observation', async () => {
  const sql=setup(), snapshot=acpFixture(), run={runId:'1',event:'schedule'};
  await publishACP(snapshot,run);
  sql.exec('CREATE TRIGGER miss_detail BEFORE UPDATE OF data ON merchant_feed_items BEGIN SELECT RAISE(IGNORE); END;');
  const item={product_id:123,data_stale:false,canonical_url:snapshot.rows[0].url,
    availability:'out_of_stock',price:{currency:'MDL',mode:'fixed',current:'10.00'}};
  const result=await refreshACP({results:[{id:'123',updatedAt:new Date().toISOString(),item}]},run);
  assert.equal(result.verified,0);
  assert.equal(JSON.parse(sql.prepare('SELECT data FROM merchant_feed_items').get().data).price,123.45);
});

test('a failed download cannot replace a suspension or a newer successful snapshot', async () => {
  const {acpFailure,setACPEnabled}=await import('../lib/discovery/acp.ts');
  const sql=setup(), run={runId:'1',event:'schedule'}, snapshot=acpFixture();
  await publishACP(snapshot,run);
  const current=await acpState();
  assert.equal((await acpFailure('late failure','2000-01-01T00:00:00Z')).skipped,true);
  assert.equal((await acpState()).failures,0);
  const [racingFailure]=await Promise.all([acpFailure('racing failure',current.lastSuccess),setACPEnabled(false)]);
  assert.equal(racingFailure.skipped,true);
  assert.equal((await acpFailure('late failure',current.lastSuccess)).skipped,true);
  const suspended=await acpState();
  assert.equal(suspended.enabled,false);
  assert.equal(suspended.digest,current.digest);
  assert.equal(suspended.error,undefined);
  await setACPEnabled(true);
  assert.equal((await acpFailure('current failure',current.lastSuccess)).failed,true);
  assert.equal((await acpState()).failures,1);
  assert.equal(sql.prepare('SELECT count(*) n FROM merchant_feed_items').get().n,1);
});

test('registered RSS ingests into SQLite, retains stable offers and preserves them after a malformed replacement',async()=>{
  const sql=setup();
  await saveFeed({...feed,format:'rss'});
  const item='<item><guid>fixture-01</guid><title>My Melody plush</title><category>my-melody</category><link>https://merchant.example/01</link><m:price>19 USD</m:price></item>';
  const catalog='<rss version="2.0" xmlns:m="http://base.google.com/ns/1.0"><channel>'+item+'</channel></rss>';
  let body=catalog;
  globalThis.fetch=async()=>new Response(body,{headers:{'content-type':'application/rss+xml'}});
  assert.equal((await runFeed(feed.id)).complete,true);
  const stored=sql.prepare('SELECT id,data FROM products').get();
  assert.equal(JSON.parse(stored.data).listings[0].price,19);
  await resetFeed(feed.id);
  body=catalog.replace('19 USD','18 USD');
  await runFeed(feed.id);
  const refreshed=sql.prepare('SELECT data FROM products WHERE id=?').get(stored.id).data;
  assert.equal(JSON.parse(refreshed).listings[0].price,18);
  await resetFeed(feed.id);
  body=catalog.replace('</channel></rss>','<item>');
  await assert.rejects(runFeed(feed.id));
  assert.equal(sql.prepare('SELECT data FROM products WHERE id=?').get(stored.id).data,refreshed);
  assert.equal(sql.prepare('SELECT count(*) n FROM listings').get().n,1);
});

test('photo review pages surface pending candidates beyond 100 historical decisions',async()=>{
 const {mediaReviewPage}=await import('../lib/discovery/media-overview.ts');
 const sql=setup();
 fetchFixture([{...row,images:[]}]);
 await saveFeed(feed);
 await runFeed(feed.id);
 const {id}=sql.prepare('SELECT id FROM products').get();
 const add=sql.prepare('INSERT INTO config(key,data) VALUES (?,?)');
 const candidate={productId:id,candidate:{url:'https://upload.wikimedia.org/example.jpg'},match:{decision:'review'}};
 for(let index=0;index<110;index++) add.run('media:a:'+String(index).padStart(3,'0'),JSON.stringify({...candidate,review:'rejected'}));
 for(let index=0;index<22;index++) add.run('media:b:'+String(index).padStart(3,'0'),JSON.stringify(candidate));
 add.run('media:b:missing',JSON.stringify({...candidate,productId:'missing'}));
 add.run('media:b:failed',JSON.stringify({...candidate,candidate:null}));
 const first=await mediaReviewPage('pending');
 assert.equal(first.entries.length,20);
 assert.equal(first.entries[0].key,'media:b:000');
 const last=await mediaReviewPage('pending',first.next);
 assert.deepEqual(last.entries.map(entry=>entry.key),['media:b:020','media:b:021']);
 assert.equal(last.next,null);
 assert.equal((await mediaOverview()).reviews.awaiting,22);
 let cursor='', seen=[];
 do {
   const page=await mediaReviewPage('all',cursor);
   seen.push(...page.entries.map(entry=>entry.key));
   cursor=page.next;
 } while(cursor);
 assert.equal(new Set(seen).size,134);
 sql.prepare('UPDATE products SET archived=1 WHERE id=?').run(id);
 assert.deepEqual((await mediaReviewPage('pending')).entries,[]);
 assert.equal((await mediaOverview()).reviews.awaiting,0);
});

test('edited feed mapping discards prior checkpoints and validators before the next fetch',async()=>{
 const sql=setup();
 fetchFixture(Array.from({length:11},(_,i)=>({...row,sourceId:'item'+i,images:[]})));
 await saveFeed(feed);
 assert.equal((await runFeed(feed.id)).complete,false);
 const {checkpoint}= (await (await import('../lib/discovery/feed-runner.ts')).feedOverview())[0];
 assert.equal(checkpoint,10);
 await saveFeed({...feed,mapping:{price:'newPrice'}});
 globalThis.fetch=async(_,options)=>{
   assert.equal(options.headers['If-None-Match'],undefined);
   return Response.json([{...row,sourceId:'item0',newPrice:12,images:[]}]);
 };
 assert.equal((await runFeed(feed.id)).complete,true);
 assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,10);
 assert.equal(sql.prepare('SELECT count(*) n FROM listings WHERE price_micros=12000000').get().n,1);
});

test('expired feed permission stops scheduled collection without a source failure',async()=>{
 setup();
 const {feedOverview,tickFeeds}=await import('../lib/discovery/feed-runner.ts');
 await saveFeed({...feed,permissionExpiresAt:'2000-01-01T00:00:00Z'});
 globalThis.fetch=async()=>{assert.fail('Expired feed must not be contacted');};
 assert.equal((await feedOverview())[0].permissionExpired,true);
 assert.equal((await tickFeeds()).eligible,0);
 await assert.rejects(runFeed(feed.id),/permission expired/);
});

test('saving during an active collection leaves its configuration untouched',async()=>{
 const sql=setup();
 await saveFeed(feed);
 let finish;
 globalThis.fetch=async()=>new Promise(resolve=>{finish=resolve;});
 const running=runFeed(feed.id);
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 try {
   await assert.rejects(saveFeed({...feed,imagesAllowed:false}),/collector is active/);
   assert.equal(JSON.parse(sql.prepare("SELECT data FROM config WHERE key='feed:fixture-feed'").get().data).imagesAllowed,true);
 } finally {
   finish(Response.json([{...row,images:[]}]));
   await running;
 }
});

test('verified retailer gallery resumes within a bounded batch and never queues failed merchant photos for manual approval',async()=>{
 const {mediaReviewPage}=await import('../lib/discovery/media-overview.ts');
 const sql=setup();
 const images=Array.from({length:12},(_,index)=>({...row.images[0],url:'https://images.example/'+index+'.jpg'}));
 let requests=0;
 globalThis.fetch=async(url,options)=>{
  if(options.method==='HEAD'){
   requests++;
   return url===images[0].url?new Response(null,{status:404}):new Response(null,{headers:{'content-type':'image/jpeg'}});
  }
  return Response.json([{...row,images},{...row,sourceId:'other',images:[{...images[0],sourceId:'other',url:'https://images.example/other.jpg'}]}]);
 };
 await saveFeed(feed);
 assert.equal((await runFeed(feed.id)).complete,false);
 assert.equal(requests,12);
 const stored=JSON.parse(sql.prepare('SELECT data FROM products').get().data);
 assert.equal(stored.images.length,11);
 assert.equal(stored.images[0].url,images[1].url);
 const failed=(await mediaReviewPage('all')).entries.find(entry=>entry.candidate.url===images[0].url);
 assert.equal(failed.match.decision,'review');
 await assert.rejects(reviewMedia(failed.key,true),/automated source verification/);
 assert.equal((await mediaReviewPage('pending')).entries.length,0);
 await resetFeed(feed.id);
 assert.equal((await runFeed(feed.id)).complete,true);
 assert.equal(requests,13);
 assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,2);
});

test('oldest due feeds get the bounded scheduler slots ahead of recently due feeds',async()=>{
 const {tickFeeds}=await import('../lib/discovery/feed-runner.ts');
 const sql=setup();
 for(const id of ['aaa','bbb','ccc']){
  await saveFeed({...feed,id});
  sql.prepare('INSERT INTO config(key,data) VALUES (?,?)').run('feed-state:'+id,JSON.stringify({nextAt:id==='aaa'?'2026-01-01T00:00:00Z':'2025-01-01T00:00:00Z'}));
 }
 fetchFixture([{...row,images:[]}]);
 assert.deepEqual((await tickFeeds()).results.map(result=>result.id),['bbb','ccc']);
});

test('consecutive failures are retained after successful recovery',async()=>{
 const {feedOverview}=await import('../lib/discovery/feed-runner.ts');
 setup();
 await saveFeed(feed);
 for(const status of [503,502]){
   globalThis.fetch=async()=>new Response(null,{status});
   await assert.rejects(runFeed(feed.id),new RegExp(String(status)));
   await resetFeed(feed.id);
 }
 fetchFixture();
 await runFeed(feed.id);
 const [item]=await feedOverview();
 assert.deepEqual(item.state.runs.map(run=>run.error||'success'),['success','Feed HTTP 502','Feed HTTP 503']);
 assert.equal(item.state.failures,0);
});

test('an active feed consumes no scheduler slot',async()=>{
 const {tickFeeds}=await import('../lib/discovery/feed-runner.ts');
 const sql=setup();
 for(const id of ['aaa','bbb','ccc'])await saveFeed({...feed,id});
 sql.prepare('INSERT INTO config(key,data) VALUES (?,?)')
   .run('feed-state:aaa',JSON.stringify({lease:'running',leaseUntil:new Date(Date.now()+60000).toISOString()}));
 fetchFixture([{...row,images:[]}]);
 assert.deepEqual((await tickFeeds()).results.map(result=>result.id),['bbb','ccc']);
});

test('photo audit checks the public edition cover and replaces old ISBN audit status',async()=>{
 const sql=setup();
 const {productStatements,now}=await import('../lib/server.ts');
 const {normalizeProduct}=await import('../lib/domain.ts');
 const catalog=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
 const book=normalizeProduct(catalog.find(product=>product.id==='openlibrary-OL21116258W'));
 await catalogBatch(productStatements(book),await catalogRevision());
 sql.prepare('INSERT INTO config(key,data) VALUES (?,?)').run('image-audit:'+book.id,
  JSON.stringify({at:now(),gallery:JSON.stringify(book.images),complete:true,results:[{url:book.images[0].url,status:'broken'}]}));
 const calls=[];
 globalThis.fetch=async url=>{
  calls.push(url);
  return new Response(null,{headers:{'content-type':'Image/JPEG; charset=binary'}});
 };
 assert.deepEqual((await mediaOverview()).audit,[]);
 assert.equal((await auditNextImage()).checked,1);
 assert.deepEqual(calls,['https://covers.openlibrary.org/b/id/10408106-M.jpg?default=false']);
 assert.deepEqual((await mediaOverview()).audit,[{status:'reachable',total:1}]);
 assert.equal((await auditNextImage()).checked,0);
});

test('owner maintenance does not move the deadline for the next scheduled execution',async()=>{
 const sql=setup();
 const expected='2026-01-01T00:00:00.000Z';
 sql.prepare('INSERT INTO config(key,data) VALUES (?,?)').run('automation-runtime',JSON.stringify({lastScheduledAt:expected,nextExpectedAt:expected}));
 await maintenanceTick({event:'owner-triggered',runId:'manual',attempt:'1'});
 const state=JSON.parse(sql.prepare("SELECT data FROM config WHERE key='automation-runtime'").get().data);
 assert.equal(state.nextExpectedAt,expected);
 assert.equal(state.lastScheduledAt,expected);
 assert.equal(state.lastRun.runId,'manual');
});
