/* One paid vehicle package; insurance fulfillment retains its idempotent balcar order. */
(() => {
  buytestPlans.balcar={name:'חבילת BuyTest לרכב אחד',price:39,scope:'צ׳קליסט מלא, אימות רישיון, דוח עבר ביטוחי, פענוח דוח מכון ושני סיכומים. גישה ל־30 ימים. התייעצות אישית אינה כלולה.'};
  let verifiedBundle=null;
  const receiptKey=p=>'buytest-bundle39-receipt:'+p;
  function tokenPayload(payment){
    if(!payment||String(payment.plate)!==plate())return null;
    try{const data=JSON.parse(atob(payment.accessToken.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));return data.plate===plate()&&Number(data.exp)>Date.now()/1000?data:null}catch{return null}
  }
  const originalSave=saveBuyTestPayment;
  function cacheBundle(value){if(value?.plan==='balcar'&&value.accessToken){try{localStorage.setItem(receiptKey(value.plate),JSON.stringify(value))}catch(_){}}}
  saveBuyTestPayment=function(value){cacheBundle(storedBuyTestPayment());cacheBundle(value);return originalSave(value)};
  function receipt(scope){
    const current=storedBuyTestPayment();
    if(activeBuyTestPlan()&&tokenPayload(current)?.scopes?.includes(scope))return current;
    return tokenPayload(verifiedBundle)?.scopes?.includes(scope)?verifiedBundle:null;
  }
  async function refreshStoredBundle(){
    let cached;try{cached=JSON.parse(localStorage.getItem(receiptKey(plate()))||'null')}catch(_){}
    if(!cached?.orderId||!cached?.clientSecret)return false;
    const p=plate();
    try{
      const data=await callBuyTestPaymentService({action:'status',orderId:cached.orderId,clientSecret:cached.clientSecret});
      if(p!==plate())return false;
      if(data.status!=='paid'||data.plan!=='balcar'||String(data.plate)!==p){verifiedBundle=null;if(storedBuyTestPayment()?.orderId===cached.orderId)lockPurchasedPlan();sync();return false;}
      verifiedBundle={...cached,accessToken:data.accessToken,expiresAt:data.expiresAt,progress:data.progress};cacheBundle(verifiedBundle);sync();return true;
    }catch(_){return false;}
  }
  const manager=()=>document.body.classList.contains('manager-mode');
  const hasReport=()=>manager()||Boolean(receipt('report'));
  const hasChecklist=()=>manager()||Boolean(receipt('premium')||receipt('report')||receipt('balcar'));
  function sync(){
    document.body.classList.toggle('bt-report-access',hasReport());
    document.body.classList.toggle('bt-checklist-access',hasChecklist());
    document.body.classList.toggle('bt-insurance-access',manager()||Boolean(receipt('balcar')));
    const paywall=document.getElementById('reportBundlePaywall');if(paywall)paywall.hidden=hasReport();
    const button=document.getElementById('buyBundle39');if(button)button.textContent=hasChecklist()?'החבילה פתוחה לרכב הזה — המשך לבדיקה':'פתיחת כל החבילה לרכב — 39 ₪';
    if(!hasChecklist())document.getElementById('vehicleChecklist').hidden=true;
  }
  async function unlock(intent='checklist'){
    if(!/^\d{7,8}$/.test(plate())){showBuyTestAccessNotice('יש להזין ולהציג מספר רכב לפני פתיחת החבילה.',true);return false;}
    sessionStorage.setItem('buytestBundleIntent',intent);
    if(!manager())await restoreBuyTestAccess({requiredPlate:plate(),scroll:false});
    if(!manager())await refreshStoredBundle();
    sync();
    if(intent==='report'?hasReport():hasChecklist()){
      if(intent==='report')openAfterPage();else {closeAfterPage(false);showFreeStart();BuyTestChecklist.open();}
      sessionStorage.removeItem('buytestBundleIntent');return true;
    }
    await startBalcarPayment();return false;
  }
  const oldStart=startPayment;
  startPayment=async function(plan='report'){
    if(plan==='report'||plan==='premium')return unlock(plan==='report'?'report':'checklist');
    return oldStart(plan);
  };
  const oldActivate=activatePurchasedPlan;
  activatePurchasedPlan=function(plan,options){
    const result=oldActivate(plan,options);
    if(plan==='balcar'){verifiedBundle=storedBuyTestPayment();cacheBundle(verifiedBundle)}
    else void refreshStoredBundle();
    sync();
    const intent=sessionStorage.getItem('buytestBundleIntent');
    if(plan==='balcar'&&hasChecklist()){
      showFreeStart();
      if(intent==='report')openAfterPage(false);
      else if(intent==='checklist')BuyTestChecklist.open();
      if(intent)sessionStorage.removeItem('buytestBundleIntent');
    }
    return result;
  };
  const oldLock=lockPurchasedPlan;
  lockPurchasedPlan=function(){oldLock();sync()};
  const oldOpen=openAfterPage;
  openAfterPage=function(scroll=true){oldOpen(scroll);sync()};
  window.BuyTestBundle={hasReport,hasChecklist,unlock,sync,refreshStoredBundle,updateReceipt:value=>{cacheBundle(value);if(value?.plan==='balcar'&&String(value.plate)===plate())verifiedBundle=value;sync()},reportReceipt:()=>receipt('report'),insuranceReceipt:()=>receipt('balcar'),checklistReceipt:()=>receipt('premium')||receipt('report')||receipt('balcar')};
  window.addEventListener('DOMContentLoaded',sync);
  window.addEventListener('pageshow',sync);
})();
