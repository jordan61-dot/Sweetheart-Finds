import test from 'node:test';
import assert from 'node:assert/strict';
import {feedSchema,assertFeed,parseFeed,readFeed,publicUrl} from '../lib/discovery/feed.ts';
import {matchImage} from '../lib/discovery/media.ts';
const at='2026-11-08T00:00:00.000Z';
const feed=feedSchema.parse({id:'test-merchant',name:'Test merchant fixture',url:'https://merchant.example/feed.json',format:'json',enabled:true,intervalHours:24,permissionUrl:'https://merchant.example/permission',permissionNote:'Fixture permission only, never represents a live source.',recurringAllowed:true,durableAllowed:true,imagesAllowed:true,imageHosts:['images.example'],permissionExpiresAt:'2027-01-01T00:00:00Z'});
const row={sourceId:'123',variantId:'pink',title:'My Melody plush',categories:['my-melody'],url:'https://merchant.example/item/123',price:19,currency:'USD',availability:'available',images:[{url:'https://images.example/pink.jpg',sourceId:'123',variantId:'pink',attribution:'Fixture photographer'}]};
test('feed IDs are stable across price changes and variants remain separate',()=>{const a=parseFeed(JSON.stringify([row]),feed,at)[0].product,b=parseFeed(JSON.stringify([{...row,price:12}]),feed,at)[0].product,c=parseFeed(JSON.stringify([{...row,variantId:'blue'}]),feed,at)[0].product;assert.equal(a.id,b.id);assert.equal(a.listings[0].id,b.listings[0].id);assert.notEqual(a.id,c.id);assert.equal(c.images.length,0);assert.equal(a.images.length,1);});
test('permissions gate collection independently of URL availability',()=>{assert.throws(()=>assertFeed(feed,[],Date.parse(at)));assert.throws(()=>assertFeed({...feed,enabled:false},['merchant.example']));assert.throws(()=>assertFeed({...feed,permissionExpiresAt:at},['merchant.example'],Date.parse(at)));assert.throws(()=>feedSchema.parse({...feed,durableAllowed:false}));});
test('malformed empty and duplicate feeds fail without inferred sellouts',()=>{for(const rows of [[],[row,row],[{...row,price:-1}],[{...row,availability:'sold maybe'}]])assert.throws(()=>parseFeed(JSON.stringify(rows),feed,at));});
test('private URLs and credentials are rejected',()=>{for(const url of ['http://merchant.example/a','https://127.0.0.1/','https://[::1]/','https://a.internal/','https://user:pass@merchant.example/','https://merchant.example:8443/'])assert.throws(()=>publicUrl(url));});
test('conditional retrieval passes validators and handles 304',async()=>{const r=await readFeed(feed,['merchant.example'],'abc','yesterday',async(url,options)=>{assert.equal(options.headers['If-None-Match'],'abc');assert.equal(options.redirect,'manual');return new Response(null,{status:304});});assert.equal(r.unchanged,true);});
test('Workers-compatible feed requests refuse redirects without following unapproved targets',async()=>{let requests=0;await assert.rejects(readFeed(feed,['merchant.example'],undefined,undefined,async(url,options)=>{requests++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://internal.example/'}});}),/HTTP 302/);assert.equal(requests,1);});
const product=parseFeed(JSON.stringify([row]),feed,at)[0].product;
const candidate={url:'https://images.example/pink.jpg',sourceUrl:product.sourceUrl,sourceProduct:'123',sourceVariant:'pink',identifiers:{},title:row.title,license:'owner-permitted',licenseUrl:feed.permissionUrl,attribution:'Fixture photographer',verifiedAt:at,contentType:'image/jpeg'};
test('only verified exact product and variant may auto-publish',()=>{assert.equal(matchImage(product,candidate,Date.parse(at)).decision,'approved');for(const change of [{sourceVariant:undefined},{verifiedAt:undefined},{sourceUrl:'https://another.example/item'},{contentType:'text/html'}])assert.equal(matchImage(product,{...candidate,...change},Date.parse(at)).decision,'review');});
test('conflicting variant, identifiers, generation and expired rights reject',()=>{assert.equal(matchImage(product,{...candidate,sourceVariant:'blue'},Date.parse(at)).decision,'rejected');assert.equal(matchImage({...product,generation:'G1'},{...candidate,generation:'G3'},Date.parse(at)).decision,'rejected');assert.equal(matchImage(product,{...candidate,expiresAt:at},Date.parse(at)).decision,'rejected');assert.equal(matchImage({...product,identifiers:{gtin:'123456789'}},{...candidate,identifiers:{gtin:'987654321'}},Date.parse(at)).decision,'rejected');});
test('generic character art never becomes an exact product photograph',()=>{assert.equal(matchImage(product,{...candidate,sourceProduct:undefined,title:product.title},Date.parse(at)).decision,'review');});

const xmlProduct = '<sourceId>123</sourceId><variantId>pink</variantId><title>My Melody plush</title><url>https://merchant.example/item/123</url><currency>USD</currency><categories>my-melody</categories>';
test('XML retailer rows retain JSON catalog identities and supported field mappings',()=>{
 const mapped = xmlProduct.replaceAll('sourceId','sku').replace('<title>My Melody plush</title>', '<title><![CDATA[My Melody & friends]]></title>');
 const config = feedSchema.parse({...feed,format:'xml',mapping:{sourceId:'sku'}});
 const [entry] = parseFeed('<products><product>'+mapped+'</product></products>',config,at);
 assert.equal(entry.product.title,'My Melody & friends');
 assert.equal(entry.product.id,product.id);
 assert.equal(entry.product.listings[0].price,null);
});

test('RSS and Atom preserve listing data, resolve namespaces, and omit unapproved artwork',async()=>{
 const google = '<m:id>123</m:id><m:price>19.00 USD</m:price><m:availability>in_stock</m:availability><m:image_link>https://images.example/test.jpg</m:image_link>';
 for(const format of ['atom','rss']){
  const atom = format==='atom';
  const root = atom ? 'feed' : 'rss';
  const wrapper = atom ? 'entry' : 'channel><item';
  const location = atom ? '<id>other</id><link rel="self" href="https://merchant.example/feed"/><link href="https://merchant.example/item/123"/><category term="my-melody"/>' : '<guid>other</guid><link>https://merchant.example/item/123</link><category>my-melody</category>';
  const body = '<'+root+' xmlns:m="http://base.google.com/ns/1.0"'+(atom?' xmlns="http://www.w3.org/2005/Atom"':' version="2.0"')+'><'+wrapper+'><title>My Melody plush</title>'+location+google+(atom?'</entry></feed>':'</item></channel></rss>');
  const config = feedSchema.parse({...feed,format});
  const received = await readFeed(config,['merchant.example'],undefined,undefined,async(_,options)=>{
   assert.match(options.headers.Accept,new RegExp(format));return new Response(body);
  });
  const [entry] = parseFeed(received.text,config,at);
  assert.equal(entry.sourceId,'123');assert.equal(entry.product.sourceUrl,row.url);
  assert.equal(entry.product.listings[0].price,19);assert.equal(entry.product.listings[0].availability,'available');
  assert.deepEqual(entry.product.images,[]);
 }
});

test('XML rejects malformed, ambiguous, oversized or unsupported catalogs before publishing rows',()=>{
 const config={...feed,format:'xml'};
 for(const body of [
  '<rss/>', '<products><other><product>'+xmlProduct+'</product></other></products>',
  '<!DOCTYPE products><products><product>'+xmlProduct+'</product></products>',
  '<products><product>'+xmlProduct+'</product>',
  '<products><product>'+xmlProduct+'<sourceId>456</sourceId></product></products>',
  '<products><product>'+xmlProduct.replace('My Melody plush','<b>My Melody</b>')+'</product></products>',
  '<products>'+'<product/>'.repeat(251)+'</products>',
  '<products>'+'<x>'.repeat(32)+'</x>'.repeat(32)+'</products>'
 ]) assert.throws(()=>parseFeed(body,config,at));
});
