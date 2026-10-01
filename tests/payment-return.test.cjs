const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function restoreHarness(result){
  const notices=[],purchases=[],activated=[],saved=[];
  const context={buyTestLastPaymentStatus:'',storedBuyTestPayment:()=>({orderId:'order-test',clientSecret:'test-secret',plate:'1234567',plan:'balcar'}),callBuyTestPaymentService:async()=>{if(result instanceof Error)throw result;return result},normalizedStageProgress:x=>x||{},saveBuyTestPayment:x=>saved.push(x),buyTestMetaTrackPurchaseOnce:x=>purchases.push(['meta',x]),buyTestGoogleTrackPurchaseOnce:x=>purchases.push(['google',x]),document:{getElementById:()=>null},activatePurchasedPlan:x=>activated.push(x),showBuyTestAccessNotice:x=>notices.push(x),clearBuyTestPayment:()=>{},lockPurchasedPlan:()=>{},console:{warn:()=>{}}};
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('async function restoreBuyTestAccess('),html.indexOf('async function restoreBuyTestAccessWithRetry(')),context);
  return {context,notices,purchases,activated,saved};
}
test('unreachable payment status does not claim payment was received or record a purchase',async()=>{
  const h=restoreHarness(new Error('offline'));
  assert.equal(await h.context.restoreBuyTestAccess({onReturn:true}),false);
  assert.equal(h.activated.length,0);assert.equal(h.purchases.length,0);
  assert.match(h.notices[0],/לא ניתן לאמת/);assert.match(h.notices[0],/אין צורך לשלם שוב/);
  assert.doesNotMatch(h.notices[0],/התשלום התקבל|התשלום אושר/);
});
test('pending, failed and refunded status never open access or record purchase',async()=>{
  for(const status of ['payment_ready','pending','failed','refunded']){
    const h=restoreHarness({status});
    assert.equal(await h.context.restoreBuyTestAccess({onReturn:true}),false);
    assert.equal(h.activated.length,0);assert.equal(h.purchases.length,0);
  }
});
test('server confirmed paid package restores package access and records purchase',async()=>{
  const h=restoreHarness({status:'paid',plate:'1234567',plan:'balcar',expiresAt:'2026-11-01T00:00:00Z',accessToken:'test-signed-token'});
  assert.equal(await h.context.restoreBuyTestAccess({onReturn:true}),true);
  assert.deepEqual(h.activated,['balcar']);assert.equal(h.purchases.length,2);
  assert.equal(h.saved[0].accessToken,'test-signed-token');
});
test('new bundle entry click is wired to the shared tracker and accepted by analytics service',()=>{
  assert.match(html,/<button[^>]+id="buyBundle39"[^>]+data-analytics-click="click_bundle_entry"/);
  const src=fs.readFileSync(path.join(root,'supabase/functions/buytest-analytics/index.ts'),'utf8');
  const context={};vm.createContext(context);
  vm.runInContext(stripTypeScriptTypes(src.slice(src.indexOf('const CLICK_EVENT_TYPES'),src.indexOf('function cors'))),context);
  assert.equal(vm.runInContext('CLICK_EVENT_TYPES.has("click_bundle_entry") && TRACK_EVENT_TYPES.has("click_bundle_entry")',context),true);
});
