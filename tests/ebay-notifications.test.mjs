import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';

const {privateKey,publicKey} = generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pem = publicKey.export({type:'spki',format:'pem'});
const endpoint = 'https://sweetheart-finds.jordanmullens12.chatgpt.site/api/ebay/account-deletion';
const message = {metadata:{topic:'MARKETPLACE_ACCOUNT_DELETION'},
  notification:{notificationId:'test-notification',data:{userId:'fixture'}}};
const auth = {appId:'fixture-id',certId:'fixture-secret'};

function notice(data=message) {
  const signature = sign('sha1',Buffer.from(JSON.stringify(message)),privateKey).toString('base64');
  const header = btoa(JSON.stringify({kid:'fixture-key',alg:'ECDSA',digest:'SHA1',signature}));
  return new Request(endpoint,{method:'POST',headers:{'x-ebay-signature':header},body:JSON.stringify(data)});
}
function token() { return Response.json({access_token:'fixture-token',expires_in:7200}); }
function key() { return Response.json({key:pem}); }

test('challenge hashes the registered endpoint and rejects a missing challenge',async()=>{
  const {ebayChallenge} = await import('../lib/ebay-account-deletion.ts');
  const secret = 'x'.repeat(40);
  const res = ebayChallenge(new Request(endpoint+'?challenge_code=fixture'),secret);
  assert.deepEqual(await res.json(),{challengeResponse:createHash('sha256').update('fixture'+secret+endpoint).digest('hex')});
  assert.equal(ebayChallenge(new Request(endpoint),secret).status,400);
});
for (const [name,replies,status,calls] of [
  ['OAuth timeout then success',[new DOMException('timed out','TimeoutError'),token,key],204,3],
  ['signing-key timeout then success',[token,new DOMException('timed out','TimeoutError'),key],204,3],
  ['expired bearer token',[token,()=>new Response(null,{status:401}),token,key],204,4],
  ['sustained upstream failure',[token,()=>new Response(null,{status:502}),()=>new Response(null,{status:502})],503,3],
  ['upstream requests backoff',[token,()=>new Response(null,{status:503,headers:{'Retry-After':'60'}})],503,2],
  ['unknown signing key',[token,()=>new Response(null,{status:404})],412,2],
]) {
  test('signed notification handles '+name,async(t)=>{
    // Isolate the OAuth and public-key caches between cases.
    const {ebayDeletionNotice} = await import('../lib/ebay-account-deletion.ts?case='+encodeURIComponent(name));
    let count = 0;
    t.mock.method(globalThis,'fetch',async(url,options)=>{
      assert.equal(new URL(url).origin,'https://api.ebay.com');
      assert.equal(options.redirect,'manual');
      assert.ok(options.signal);
      const next = replies[count++];
      if(next instanceof Error) throw next;
      return next();
    });
    assert.equal((await ebayDeletionNotice(notice(),auth)).status,status);
    assert.equal(count,calls);
    if(status===204) {
      assert.equal((await ebayDeletionNotice(notice(),auth)).status,204);
      assert.equal((await ebayDeletionNotice(notice({...message,notification:{...message.notification,notificationId:'different'}}),auth)).status,412);
      assert.equal(count,calls);
    }
  });
}
