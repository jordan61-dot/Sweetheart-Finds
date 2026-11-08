// Public identities, not secrets. Repository IDs were verified through GitHub's API.
export const collectorIdentity={repository:'jordan61-dot/Sweetheart-Finds',repositoryId:'1449222249',ownerId:'348051783',workflow:'jordan61-dot/Sweetheart-Finds/.github/workflows/collect-permissioned-feeds.yml@refs/heads/main',audience:'https://sweetheart-finds.jordanmullens12.chatgpt.site/api/automation/tick'};
const issuer='https://token.actions.githubusercontent.com';
type SigningKey=JsonWebKey&{kid:string};
let cached:{at:number;keys:SigningKey[]}|undefined;
const denied=()=>Object.assign(Error('Unauthorized collector identity'),{status:401});
function decode(s:string){if(!/^[A-Za-z0-9_-]+$/.test(s))throw denied();return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export type CollectorClaims={runId:string;attempt:string;event:string;jti:string;expires:number};
export async function verifyGitHubIdentity(token:string,options:{clock?:number;keys?:SigningKey[];fetcher?:typeof fetch}={}):Promise<CollectorClaims>{
 const clock=options.clock??Date.now();if(token.length>16384)throw denied();const parts=token.split('.');if(parts.length!==3)throw denied();let header:any,claims:any;try{header=JSON.parse(new TextDecoder().decode(decode(parts[0])));claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));}catch{throw denied();}
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200||header.jku||header.jwk||header.x5u||header.crit)throw denied();
 // Reject other repositories before fetching a public key, limiting unauthenticated work.
 const validSubjects=[`repo:${collectorIdentity.repository}:ref:refs/heads/main`,`repo:jordan61-dot@${collectorIdentity.ownerId}/Sweetheart-Finds@${collectorIdentity.repositoryId}:ref:refs/heads/main`];
 if(claims.iss!==issuer||claims.aud!==collectorIdentity.audience||claims.repository!==collectorIdentity.repository||claims.repository_id!==collectorIdentity.repositoryId||claims.repository_owner_id!==collectorIdentity.ownerId||claims.workflow_ref!==collectorIdentity.workflow||claims.ref!=='refs/heads/main'||!validSubjects.includes(claims.sub)||!['schedule','workflow_dispatch','push'].includes(claims.event_name)||claims.repository_visibility!=='public'||claims.runner_environment!=='github-hosted')throw denied();
 const seconds=clock/1000;if(![claims.exp,claims.iat,claims.nbf].every(Number.isFinite)||claims.exp<=seconds||claims.iat>seconds+30||claims.nbf>seconds+30||claims.iat<seconds-900||claims.exp-claims.iat>900||claims.exp<=claims.iat||!/^\d+$/.test(claims.run_id)||!/^\d+$/.test(claims.run_attempt)||typeof claims.jti!=='string'||claims.jti.length<8||claims.jti.length>200)throw denied();
 let keys=options.keys;
 if(!keys){if(!cached||clock-cached.at>3600000){const r=await (options.fetcher||fetch)(issuer+'/.well-known/jwks',{redirect:'manual',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Object.assign(Error('GitHub signing keys unavailable'),{status:503});const text=await r.text();if(text.length>100000)throw denied();const data=JSON.parse(text);if(!Array.isArray(data.keys)||data.keys.length>20)throw denied();cached={at:clock,keys:data.keys};}keys=cached.keys;}
 const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));if(!jwk)throw denied();
 try{const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw denied();}catch{throw denied();}
 return {runId:claims.run_id,attempt:claims.run_attempt,event:claims.event_name,jti:claims.jti,expires:claims.exp};
}
