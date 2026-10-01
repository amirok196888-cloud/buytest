const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module'),crypto=require('node:crypto');
const plate='12345678',secret='fixture-signing-secret';
function token(scopes=['report'],p=plate,exp=Math.floor(Date.now()/1000)+3600,plan='balcar'){
 const payload=Buffer.from(JSON.stringify({oid:'fixture-order',plate:p,plan,scopes,exp})).toString('base64url');
 return payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('base64url');
}
function handler({status='paid',orderPlate=plate,orderPlan='balcar',expired=false,vehicles=[]}={}){
 let fn;const code=fs.readFileSync(require.resolve('../supabase/functions/buytest-analyze/index.ts'),'utf8').replace(/^import .*;\s*/,'');
 const context={Deno:{env:{get:()=> 'fixture'},serve:f=>fn=f},Request,Response,Headers,URL,TextEncoder,TextDecoder,Uint8Array,crypto:crypto.webcrypto,atob,btoa,console,
 fetch:async(url,opts={})=>{
  let result=[];
  if(url.includes('buytest_get_private_config'))result=JSON.parse(opts.body).p_name==='buytest_entitlement_hmac_secret'?secret:'';
  if(url.includes('buytest_orders?'))result=[{id:'fixture-order',status,plate:orderPlate,plan:orderPlan,expires_at:new Date(Date.now()+(expired?-1:1)*86400000).toISOString(),provider_payload:{packageVehicles:vehicles}}];
  return new Response(JSON.stringify(result),{status:200});
 }};vm.createContext(context);vm.runInContext(stripTypeScriptTypes(code),context);return body=>fn(new Request('https://example.test',{method:'POST',headers:{origin:'https://buytest.co.il','content-type':'application/json'},body:JSON.stringify({summaryText:'רעידות בתיבת הילוכים',expected:{plate},...body})}));
}
test('signed paid package opens report analysis',async()=>{const r=await handler()({accessToken:token()});assert.equal(r.status,200);assert.ok((await r.json()).summary.findings.length)});
test('payment proof cannot be used for another plate or omit the plate',async()=>{for(const expected of [{plate:'87654321'},{}])assert.equal((await handler()({accessToken:token(),expected})).status,409)});
test('expired, refunded, unpaid and tampered receipts cannot open analysis',async()=>{
 for(const status of ['pending','refunded','cancelled'])assert.equal((await handler({status})({accessToken:token()})).status,403);
 assert.equal((await handler({expired:true})({accessToken:token()})).status,403);
 assert.equal((await handler()({accessToken:token(['report'],plate,Math.floor(Date.now()/1000)-1)})).status,403);
 assert.equal((await handler()({accessToken:token()+'tampered'})).status,403);
});
test('consultation-only entitlement cannot unlock reports',async()=>{assert.equal((await handler({orderPlan:'consultation'})({accessToken:token(['consultation'],plate,Math.floor(Date.now()/1000)+3600,'consultation')})).status,403)});
test('legacy multi-vehicle packages retain their registered plate access',async()=>{
 const opts={orderPlate:'87654321',orderPlan:'three250',vehicles:[plate]};const accessToken=token(['report'],plate,Math.floor(Date.now()/1000)+3600,'three250');
 assert.equal((await handler(opts)({accessToken})).status,200);
 assert.equal((await handler({...opts,vehicles:[]})({accessToken})).status,403);
});
