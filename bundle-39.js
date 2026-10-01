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
    const button=document.getElementById('buyBundle39');if(button){button.textContent=hasChecklist()?'כניסה למהלך הבדיקה':'כניסה למהלך הבדיקה — 39 ₪';button.hidden=false;}
    if(!hasChecklist())document.getElementById('vehicleChecklist').hidden=true;
    document.querySelectorAll('.btStageNav').forEach(nav=>{
      nav.hidden=!hasChecklist();
      nav.querySelectorAll('[data-stage]').forEach(button=>{
        const current=button.dataset.stage===document.body.dataset.bundleStep;
        button.setAttribute('aria-current',current?'step':'false');
      });
    });
  }
  async function unlock(intent='checklist'){
    if(!/^\d{7,8}$/.test(plate())){showBuyTestAccessNotice('יש להזין ולהציג מספר רכב לפני פתיחת החבילה.',true);return false;}
    if(intent==='report'?hasReport():hasChecklist()){navigate(intent);return true;}
    sessionStorage.setItem('buytestBundleIntent',intent);
    if(!manager())await restoreBuyTestAccess({requiredPlate:plate(),scroll:false});
    if(!manager())await refreshStoredBundle();
    sync();
    if(intent==='report'?hasReport():hasChecklist()){
      navigate(intent);
      sessionStorage.removeItem('buytestBundleIntent');return true;
    }
    buyTestGoogleTrackBundleClickOnce(plate());
    await oldStart('balcar');return false;
  }
  function focusStage(target){
    if(!target)return;
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  function navigate(step='checklist'){
    document.body.dataset.bundleStep=step;
    document.body.classList.remove('consultation-page');document.getElementById('consultationPage').hidden=true;
    if(step==='report'){
      openAfterPage(false);sync();
      focusStage(document.getElementById('afterInspectionSection'));
      return;
    }
    closeAfterPage(false);showFreeStart();
    if(step==='insurance'){
      document.getElementById('vehicleChecklist').hidden=true;showInsuranceStart();
      focusStage(document.getElementById('insuranceStartSection'));
    }else{
      BuyTestChecklist.open();
      document.body.dataset.bundleStep='checklist';
    }
    sync();
  }
  const oldRestoreChecklist=BuyTestChecklist.restore;
  BuyTestChecklist.restore=function(p){
    const result=oldRestoreChecklist(p);
    document.body.dataset.bundleStep='lookup';sync();return result;
  };
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
      navigate(intent||'checklist');
      if(intent)sessionStorage.removeItem('buytestBundleIntent');
    }
    return result;
  };
  const oldLock=lockPurchasedPlan;
  lockPurchasedPlan=function(){oldLock();sync()};
  const oldOpen=openAfterPage;
  openAfterPage=function(scroll=true){document.body.dataset.bundleStep='report';oldOpen(scroll);sync()};
  window.BuyTestBundle={navigate,hasReport,hasChecklist,unlock,sync,refreshStoredBundle,updateReceipt:value=>{cacheBundle(value);if(value?.plan==='balcar'&&String(value.plate)===plate())verifiedBundle=value;sync()},reportReceipt:()=>receipt('report'),insuranceReceipt:()=>receipt('balcar'),checklistReceipt:()=>receipt('premium')||receipt('report')||receipt('balcar')};
  window.addEventListener('DOMContentLoaded',()=>{
    for(const id of ['vehicleChecklist','insuranceStartSection','afterInspectionSection','afterInsuranceChoices']){
      const host=document.getElementById(id),nav=document.createElement('nav');
      nav.className='btStageNav';nav.setAttribute('aria-label','חלקי הבדיקה לרכב');
      for(const [step,label] of [['checklist','צ׳קליסט'],['insurance','עבר ביטוחי'],['report','פענוח דוח']]){
        const button=document.createElement('button');button.type='button';button.dataset.stage=step;button.textContent=label;
        button.addEventListener('click',()=>void unlock(step));nav.appendChild(button);
      }
      host.prepend(nav);
    }
    const insurance=document.getElementById('insuranceStartSection'),back=document.createElement('button');
    back.type='button';back.className='secondary full';back.textContent='חזרה לנתוני הרכב';back.onclick=returnToVehicle;insurance.appendChild(back);
    document.body.dataset.bundleStep=document.body.classList.contains('after-page')?'report':'lookup';sync();});
  window.addEventListener('pageshow',sync);
})();
