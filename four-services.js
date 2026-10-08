/* Four independent entry pages. Only home navigation; one dossier per vehicle. */
(() => {
  const services={balcar:{title:'פענוח דוח עבר ביטוחי'},insurance:{title:'פענוח עבר ביטוחי — חינם'},checklist:{title:'צ׳קליסט לפני קנייה — חינם'},report:{title:'פענוח דוח מכון — חינם'},consultation:{title:'ייעוץ אישי עם עמוס — 99 ₪'}};
  let current='';
  let freshReportSessionPending=false;
  let reportStarted=false;
  function beginNewReportSession(){freshReportSessionPending=true;}
  function consumeNewReportSession(p){if(!freshReportSessionPending)return false;freshReportSessionPending=false;if(typeof btBeginNewReportSession==='function')btBeginNewReportSession(p);return true;}
  const readRoute=()=>{const requested=new URLSearchParams(location.search).get('service')|| (location.hash==='#report'?'report':'');return requested==='insurance'||requested==='balcar'?'report':requested;};
  function updateSummary(){
    const box=document.getElementById('serviceSummaryContent');if(!box)return;
    box.replaceChildren();
    const entries=btUnifiedEntries();
    if(!/^\d{7,8}$/.test(plate())||!Object.keys(btDossier().sources).length){box.textContent='לאחר הזנת מספר רכב, המידע שתאספו יופיע כאן.';return;}
    for(const entry of entries){const item=document.createElement(entry.heading?'h3':'p');item.textContent=entry.text;if(entry.alert)item.classList.add('btCritical');box.append(item);}
  }
  function render(route=readRoute()){
    if(route==='report'&&current!=='report'){beginNewReportSession();consumeNewReportSession(plate());reportStarted=false;document.body.dataset.reportStarted='false';}
    else if(route!=='report')freshReportSessionPending=false;
    current=services[route]?route:'';
    document.body.dataset.service=current||'home';
    closeAfterPage(false);document.body.classList.remove('consultation-page');document.getElementById('consultationPage').hidden=true;
    document.getElementById('beforeInspectionRoute').hidden=true;
    document.getElementById('afterInspectionRoute').hidden=true;
    document.body.dataset.bundleStep=current||'lookup';
    if(current==='report'){openAfterPage(false);document.getElementById('afterPageVehicle').style.display='none';document.getElementById('afterPagePlate').value=plate();}
    if(current==='consultation'){document.body.classList.add('consultation-page');document.getElementById('consultationPage').hidden=false;document.getElementById('advicePlate').value=plate();document.getElementById('prebuyVehiclePlate').value=plate();const source=btDossier().sources.consultation;document.getElementById('prebuyQuestion').value=source?.question||'';document.getElementById('prebuyAdLink').value=source?.adLink||'';document.getElementById('adviceNotes').value=source?.note||'';}
    const vehicleLookup=document.getElementById('vehicleLookup');
    if(vehicleLookup) vehicleLookup.style.display=current==='insurance'||current==='balcar'?'none':'block';
    const insuranceStart=document.getElementById('insuranceStartSection');
    if(insuranceStart) insuranceStart.style.setProperty('display','none','important');
    if(current==='insurance'||current==='balcar') showBalcarUpload();
    else {const uploadPage=document.getElementById('balcarUploadPage');if(uploadPage)uploadPage.style.display='none';}
    if(current==='checklist'&&/^\d{7,8}$/.test(plate())){BuyTestChecklist.open();document.body.dataset.bundleStep='checklist';}
    const head=document.getElementById('independentServiceHeader');
    head.querySelector('h1').textContent=services[current]?.title||'';
    const main=document.querySelector('#appShell main');
    const upload=document.getElementById('afterInspectionSection');
    const insuranceUpload=document.getElementById('balcarUploadPage');
    const host=current==='report'?document.getElementById('afterPage'):current==='consultation'?document.getElementById('consultationPage'):main;
    if(current==='report'){
      if(upload)host.append(upload);
      document.getElementById('reportInsuranceUploadButton')?.remove();
      if(insuranceUpload)insuranceUpload.style.display='none';
    }else{
      document.getElementById('reportInsuranceUploadButton')?.remove();
      if(upload&&main&&upload.parentElement!==main)main.append(upload);
      if(insuranceUpload&&main&&insuranceUpload.parentElement!==main){insuranceUpload.style.display='none';main.append(insuranceUpload);}
    }
    host.prepend(head);host.append(document.getElementById('serviceSummary'));
    document.getElementById('serviceSummary').hidden=!current||current==='balcar'||current==='insurance'||current==='report';
    document.title=current?services[current].title+' | BuyTest':'BuyTest — לפני קניית רכב';
    BuyTestBundle.sync();updateSummary();
  }
  function beginReport(){
    if(current!=='report')render('report');
    reportStarted=true;
    document.body.dataset.reportStarted='true';
    document.body.classList.add('plan-report');
    const entry=document.getElementById('preSummarySection');
    if(entry){entry.classList.remove('active');entry.style.display='none';}
    const upload=document.getElementById('afterInspectionSection');
    if(upload){upload.style.display='block';upload.scrollIntoView({behavior:'smooth',block:'start'});}
    document.getElementById('inspectionOwnerName')?.focus({preventScroll:true});
    return true;
  }
  function captureAdvice(){if(!/^\d{7,8}$/.test(plate()))return;const question=document.getElementById('prebuyQuestion').value,adLink=document.getElementById('prebuyAdLink').value,note=document.getElementById('adviceNotes').value;btSaveSource('consultation',{title:'שאלות והערות מהייעוץ — דיווח המשתמש',question,adLink,note,text:[question,adLink,note?'הערות המשתמש מהייעוץ: '+note:''].filter(Boolean).join('\n')});}
  function home(event){event?.preventDefault();
    BuyTestChecklist.capture();
    const url=new URL(location.href);url.searchParams.delete('service');url.hash='';history.pushState(null,'',url.pathname+url.search);render('');window.scrollTo({top:0,behavior:'instant'});
  }
  const oldLoad=loadVehicle;
  loadVehicle=async function(...args){setCustomerRoute('free');const result=await oldLoad(...args);await BuyTestBundle.refreshStoredBundle();render(current);return result;};
  const oldRefresh=btRefreshSummary;
  btRefreshSummary=function(...args){const result=oldRefresh(...args);updateSummary();return result;};
  const oldOpenWhatsApp=openPrebuyWhatsApp;
  openPrebuyWhatsApp=function(){if(!document.body.classList.contains('manager-mode')&&!BuyTestBundle.adviceReceipt())return; captureAdvice();return oldOpenWhatsApp();};
  const oldActivate=activatePurchasedPlan;activatePurchasedPlan=function(...args){const result=oldActivate(...args);if(document.getElementById('independentServiceHeader'))render(current);return result;};
  window.BuyTestServices={render,home,updateSummary,beginNewReportSession,consumeNewReportSession,beginReport};
  const priorHasReport=BuyTestBundle.hasReport;
  BuyTestBundle.hasReport=()=>reportStarted||priorHasReport();
  const priorUnlock=BuyTestBundle.unlock;
  BuyTestBundle.unlock=async(intent='checklist',...args)=>intent==='report'&&current==='report'?beginReport():priorUnlock(intent,...args);
  window.addEventListener('popstate',()=>render());
  window.addEventListener('DOMContentLoaded',()=>{
    const lookup=document.getElementById('vehicleLookup');
    const field=document.createElement('div');field.className='landingFreeStart';
    field.innerHTML='<h2 id="vehicleLookupTitle">מספר הרכב</h2><p id="vehicleLookupLead">המידע והסיכום נשמרים לפי מספר הרכב במכשיר ובדפדפן הזה.</p>';
    field.append(document.getElementById('plate'));
    const confirm=document.createElement('button');confirm.type='button';confirm.className='primary full';confirm.textContent='אישור מספר הרכב';confirm.onclick=startFreeCheckFromLanding;field.append(confirm);lookup.prepend(field);lookup.style.display='block';
    const header=document.createElement('header');header.id='independentServiceHeader';
    header.innerHTML='<a href="/" class="secondary serviceHome">→ חזרה לדף הראשי</a><h1></h1>';
    document.querySelector('#appShell main').prepend(header);
    const summary=document.createElement('section');summary.id='serviceSummary';summary.className='card';
    summary.innerHTML='<h2>הסיכום לרכב שלך</h2><p>כאן מתרכז המידע שנאסף בשירותים שבהם השתמשתם לאותו רכב. שירות שלא בוצע לא יופיע בסיכום.</p><div id="serviceSummaryContent"></div><button type="button" class="secondary full">שמירת הסיכום כ־PDF</button>';
    summary.querySelector('button').id='serviceSummaryPdf';summary.querySelector('button').onclick=()=>{btRefreshSummary();shareReportPdf('serviceSummaryPdf');};
    document.querySelector('#appShell main').append(summary);
    const advice=document.createElement('div');advice.className='card';
    advice.innerHTML='<label for="advicePlate">מספר הרכב לייעוץ ולסיכום</label><input id="advicePlate" inputmode="numeric" maxlength="8" placeholder="7 או 8 ספרות"><button type="button" class="secondary full">אישור מספר הרכב</button>';
    document.getElementById('consultationPurchaseIntro').before(advice);
    advice.querySelector('input').oninput=function(){sanitizePlateInput(this);};
    advice.querySelector('button').onclick=async()=>{const input=advice.querySelector('input');if(!/^\d{7,8}$/.test(input.value)){input.setCustomValidity('יש להזין מספר רכב בן 7 או 8 ספרות');input.reportValidity();return;}input.setCustomValidity('');document.getElementById('plate').value=input.value;document.getElementById('prebuyVehiclePlate').value=input.value;await loadVehicle();};
    document.querySelectorAll('.serviceHome,.appBackHome').forEach(link=>link.onclick=home);
    document.querySelector('#afterPage>button')?.setAttribute('hidden','');
    document.querySelector('#consultationPage>button')?.setAttribute('hidden','');
    document.getElementById('consultationPage').append(document.getElementById('prePurchaseConsultationBox'));
    const notes=document.createElement('div');notes.className='field wide';notes.innerHTML='<label for="adviceNotes">הערות מהייעוץ לסיכום (רשות)</label><textarea id="adviceNotes" maxlength="4000" placeholder="אפשר לרשום כאן את הדברים שעלו בייעוץ"></textarea>';document.querySelector('#prePurchaseConsultationBox .consultationFormGrid').append(notes);
    for(const id of ['prebuyQuestion','prebuyAdLink','adviceNotes'])document.getElementById(id).addEventListener('input',captureAdvice);
    document.getElementById('prebuyVehiclePlate').readOnly=true;
    document.getElementById('prebuyVehiclePlate').value=plate();
    document.getElementById('prebuyVehiclePlate').previousElementSibling.textContent='מספר הרכב שנבחר';
    document.querySelector('#insuranceStartSection h3').textContent='פענוח עבר ביטוחי — חינם';
    document.querySelectorAll('.returnBtn').forEach(button=>{button.textContent='חזרה לדף הראשי';button.onclick=home;});
    const insuranceText=document.querySelector('#insuranceStartSection .info');insuranceText.textContent=insuranceText.textContent.replace('החבילה','שירות העבר הביטוחי');
    render();
  });
})();
