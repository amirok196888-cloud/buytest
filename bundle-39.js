/* Independent receipts per service and vehicle; legacy package receipts remain valid. */
(() => {
  const verified=new Map();
  const key=p=>'buytest-service-receipts:'+p;
  function payload(payment){
    if(!payment||String(payment.plate)!==plate())return null;
    try{const data=JSON.parse(atob(payment.accessToken.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));return data.plate===plate()&&Number(data.exp)>Date.now()/1000?data:null}catch{return null}
  }
  function cache(value){
    if(!value?.orderId||!/^\d{7,8}$/.test(String(value.plate)))return;
    try{const entries=JSON.parse(localStorage.getItem(key(value.plate))||'{}');entries[value.plan]=value;localStorage.setItem(key(value.plate),JSON.stringify(entries));}catch(_){}
  }
  const originalSave=saveBuyTestPayment;
  saveBuyTestPayment=function(value){cache(storedBuyTestPayment());cache(value);if(value?.accessToken)verified.set(value.orderId,value);return originalSave(value)};
  function receipt(scope){
    const current=storedBuyTestPayment();
    if(activeBuyTestPlan()&&payload(current)?.scopes?.includes(scope))return current;
    return [...verified.values()].find(value=>payload(value)?.scopes?.includes(scope))||null;
  }
  async function refreshStoredBundle(){
    const p=plate();let entries={};
    try{entries=JSON.parse(localStorage.getItem(key(p))||'{}');const old=JSON.parse(localStorage.getItem('buytest-bundle39-receipt:'+p)||'null');if(old?.orderId)entries.legacy=old;}catch(_){}
    cache(storedBuyTestPayment());
    await Promise.all(Object.values(entries).map(async value=>{
      if(!value?.orderId||!value.clientSecret)return;
      try{const data=await callBuyTestPaymentService({action:'status',orderId:value.orderId,clientSecret:value.clientSecret});
        if(p!==plate())return;
        verified.delete(value.orderId);
        if(data.status==='paid'&&String(data.plate)===p){const updated={...value,...data};verified.set(value.orderId,updated);cache(updated);}
      }catch(_){}
    }));sync();return true;
  }
  const manager=()=>document.body.classList.contains('manager-mode');
  const hasReport=()=>manager()||Boolean(receipt('report'));
  const hasChecklist=()=>true;
  function sync(){
    document.body.classList.toggle('bt-report-access',hasReport());
    document.body.classList.add('bt-checklist-access');
    document.body.classList.toggle('bt-advice-access',manager()||Boolean(receipt('prebuy')||receipt('consultation')));
    document.body.classList.toggle('bt-insurance-access',manager()||Boolean(receipt('balcar')));
    const paywall=document.getElementById('reportBundlePaywall');if(paywall)paywall.hidden=hasReport();
    const button=document.getElementById('balcarPlanButton');if(button)button.textContent='יש לי קובץ דוח — להעלאה ולפענוח';
  }
  const oldStart=startPayment;
  async function unlock(intent='checklist'){
    if(!/^\d{7,8}$/.test(plate())){showBuyTestAccessNotice('יש להזין מספר רכב בן 7 או 8 ספרות.',true);return false;}
    if(intent==='checklist'||intent==='insurance'){navigate(intent);return true;}
    if(intent==='report'&&document.body.classList.contains('after-page'))closeAfterPage(false);
    await refreshStoredBundle();
    if(intent==='report'?hasReport():Boolean(receipt('balcar'))){navigate(intent);return true;}
    return oldStart(intent==='report'?'report':'balcar');
  }
  function navigate(step){if(window.BuyTestServices)BuyTestServices.render(step);}
  startPayment=async function(plan='report'){
    if(plan==='balcar'){showBuyTestAccessNotice('הפקת דוחות חדשים אינה זמינה כרגע. ניתן להעלות דוח קיים לפענוח.',true);return false;}
    if(plan==='premium')return unlock('checklist');
    if(plan==='report')return unlock('report');
    return oldStart(plan);
  };
  const oldActivate=activatePurchasedPlan;
  activatePurchasedPlan=function(plan,options){const result=oldActivate(plan,options);const value=storedBuyTestPayment();cache(value);if(value?.accessToken)verified.set(value.orderId,value);sync();return result;};
  const oldLock=lockPurchasedPlan;
  lockPurchasedPlan=function(){oldLock();sync()};
  window.BuyTestBundle={navigate,hasReport,hasChecklist,unlock,sync,refreshStoredBundle,
    updateReceipt:value=>{cache(value);if(value?.accessToken)verified.set(value.orderId,value);sync()},
    adviceReceipt:()=>receipt('prebuy')||receipt('consultation'),reportReceipt:()=>receipt('report'),insuranceReceipt:()=>receipt('balcar'),checklistReceipt:()=>receipt('premium')};
  window.addEventListener('DOMContentLoaded',sync);
})();
