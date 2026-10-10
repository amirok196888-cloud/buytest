/* Consultation suitability enquiry, optional direct purchase, and honest campaign counts. */
(function(root){
  const PATH='/consultation-funnel/v1';
  const EVENTS={entry:'click_landing_consultation',inquiry:'click_prebuy_whatsapp',checkout:'click_consultation_plan'};
  function createTracker({identity,send,blocked,vehicle=()=>'',attribution=()=>({})}){
    const done=new Set(),pending=new Map();
    return function track(stage){
      if(blocked()||!EVENTS[stage])return Promise.resolve();
      const ids=identity(),key=ids.sessionId+':'+stage;
      if(done.has(key))return Promise.resolve();
      if(pending.has(key))return pending.get(key);
      const body={action:'track',eventType:EVENTS[stage],pagePath:PATH,pageTitle:'ייעוץ אישי',vehiclePlate:vehicle(),...ids,...attribution()};
      const task=Promise.resolve().then(()=>send(body)).then(result=>{
        if(result?.ok===false)throw Error('consultation_tracking_failed');
        done.add(key);
      }).catch(()=>{}).finally(()=>pending.delete(key));
      pending.set(key,task);return task;
    };
  }
  function createController({paid,startCheckout,open,close,track,checkoutOpened,openWhatsApp,price=()=>99}){
    let selected='prebuy';
    return {
      entered(){return track('entry');},
      async start(plan='prebuy',...args){
        if(!['prebuy','consultation','report_consultation'].includes(plan)||paid())return startCheckout(plan,...args);
        selected=plan==='report_consultation'?'consultation':plan;
        void track('entry');open();
      },
      async purchase(plan){
        close();const result=await startCheckout(plan||selected);
        if(checkoutOpened())void track('checkout');
        return result;
      },
      inquire(){
        void track('entry');
        const message=['שלום עמוס, אני מעוניין/ת בייעוץ לפני קניית רכב.','אני בשלב של: ____','השאלה המרכזית שלי: ____','האם הייעוץ מתאים למקרה שלי ומתי אפשר לקבל מענה?','הבנתי שבירור התאמה וזמינות ללא עלות, והייעוץ המקצועי בתשלום של '+price()+' ₪.'].join('\n');
        const result=openWhatsApp(message);
        if(result!==false)void track('inquiry');
        return result;
      },
      close
    };
  }
  function statsRows(stats){return [
    ['נכנסו לעמוד / לשלב המקדים של הייעוץ',stats?.entries],
    ['פתחו וואטסאפ לבירור מקדים',stats?.inquiries],
    ['פתחו את טופס התשלום לייעוץ',stats?.checkouts],
    ['תשלומי ייעוץ שאושרו בפועל',stats?.payments]
  ];}
  const api={PATH,EVENTS,createTracker,createController,statsRows};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  const track=createTracker({identity:()=>buyTestAnalyticsIdentity(),send:b=>callBuyTestAnalyticsService(b),blocked:()=>root.BuyTestInternalTraffic.blocked(),vehicle:()=>plate(),attribution:()=>buyTestTrafficAttribution()});
  let opener=null,previousOverflow='',overlay;
  const priorStart=startPayment;
  const price=()=>Number(buytestPlans.prebuy?.price||99);
  const controller=createController({
    paid:()=>document.body.classList.contains('manager-mode')||Boolean(root.BuyTestBundle?.adviceReceipt()),
    startCheckout:(...args)=>priorStart(...args),track,price,
    open(){
      opener=document.activeElement;previousOverflow=document.body.style.overflow;
      overlay.hidden=false;document.body.style.overflow='hidden';
      overlay.querySelector('[data-inquiry]').focus();
    },
    close(){if(!overlay||overlay.hidden)return;overlay.hidden=true;document.body.style.overflow=previousOverflow;opener?.focus?.();},
    checkoutOpened:()=>document.getElementById('paymentOverlay')?.hidden===false,
    openWhatsApp:message=>openBuyTestWhatsApp(message)
  });
  function renderStats(stats){
    const body=document.getElementById('analyticsConsultationRows'),note=document.getElementById('analyticsConsultationNote');
    if(!body)return;
    body.replaceChildren();
    for(const [label,value] of statsRows(stats)){
      const row=document.createElement('tr'),title=document.createElement('td'),count=document.createElement('td');
      title.textContent=label;count.textContent=stats?Number(value||0).toLocaleString('he-IL'):'—';row.append(title,count);body.append(row);
    }
    note.textContent=stats?'כניסות ופעולות נספרות פעם אחת בכל ביקור בטווח שנבחר. פתיחת וואטסאפ אינה אישור לשליחת הודעה. תשלומים נספרים רק לאחר אישור בפועל. מדידת הכניסות והבירורים מתחילה מהעדכון הזה ואינה משחזרת ביקורים קודמים.':'נתוני הייעוץ עדיין לא נטענו.';
  }
  root.BuyTestConsultation={...controller,renderStats};
  startPayment=(...args)=>controller.start(...args);
  const priorOpenPage=openConsultationPage;
  openConsultationPage=function(...args){void controller.entered();return priorOpenPage(...args);};
  function boot(){
    const intro=document.getElementById('consultationPurchaseIntro');
    if(!intro)return;
    intro.querySelector('h3,h2').textContent='ייעוץ אישי לפני קניית רכב';
    intro.querySelector('p').textContent='מעבר אישי עם עמוס על השאלות והממצאים, הבנת המשמעות שלהם והכוונה לבירורים שכדאי להשלים לפני הקנייה. הייעוץ מתקיים בוואטסאפ; אפשר להתחיל גם בלי דוח.';
    const purchase=intro.querySelector('button');
    purchase.textContent='לרכישת ייעוץ — '+price()+' ₪';purchase.removeAttribute('onclick');purchase.onclick=()=>controller.purchase('prebuy');
    const actions=document.createElement('div');actions.className='paymentActions';
    const inquiry=document.createElement('button');inquiry.type='button';inquiry.className='secondary full';inquiry.textContent='יש לי שאלה לפני הרכישה';inquiry.onclick=()=>controller.inquire();
    const explanation=document.createElement('p');explanation.textContent='בירור התאמה וזמינות ללא עלות. הייעוץ המקצועי המלא מתחיל לאחר התשלום.';
    purchase.before(explanation,actions);actions.append(inquiry,purchase);
    overlay=document.createElement('div');overlay.id='consultationPreflightOverlay';overlay.className='paymentOverlay';overlay.hidden=true;
    const dialog=document.createElement('section');dialog.className='paymentDialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','consultationPreflightTitle');
    dialog.innerHTML='<h2 id="consultationPreflightTitle">ייעוץ אישי עם עמוס — 99 ₪</h2><p>מעבר אישי על השאלות והממצאים והכוונה לבירורים שכדאי להשלים לפני הקנייה. הייעוץ מתקיים בוואטסאפ.</p><p>אפשר לברר התאמה וזמינות ללא עלות, או לרכוש מיד. הייעוץ המקצועי המלא מתחיל לאחר התשלום.</p><div class="paymentActions"><button type="button" class="secondary full" data-inquiry>יש לי שאלה לפני הרכישה</button><button type="button" class="primary full" data-purchase>לרכישת ייעוץ — 99 ₪</button><button type="button" class="secondary full" data-close>חזרה</button></div>';
    dialog.querySelector('h2').textContent='ייעוץ אישי עם עמוס — '+price()+' ₪';
    dialog.querySelector('[data-purchase]').textContent='לרכישת ייעוץ — '+price()+' ₪';
    dialog.querySelector('[data-inquiry]').onclick=()=>controller.inquire();dialog.querySelector('[data-purchase]').onclick=()=>controller.purchase();dialog.querySelector('[data-close]').onclick=()=>controller.close();
    overlay.append(dialog);document.body.append(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)controller.close();});
    overlay.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();controller.close();}
      if(e.key==='Tab'){
        const buttons=[...dialog.querySelectorAll('button')],first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    document.getElementById('consultationFreeInquiry')?.addEventListener('click',e=>{e.preventDefault();controller.inquire();});
    const grid=document.querySelector('#managerAnalyticsPanel .analyticsGrid');
    if(grid){const section=document.createElement('div');section.innerHTML='<h3 class="analyticsSourceTitle">ייעוץ אישי — כניסות, בירורים ותשלומים</h3><div class="analyticsSourceWrap"><table class="analyticsSourceTable analyticsArticleTable" aria-label="פעילות בשירות הייעוץ"><thead><tr><th scope="col">פעולה</th><th scope="col">כמות</th></tr></thead><tbody id="analyticsConsultationRows"></tbody></table></div><p id="analyticsConsultationNote" class="analyticsNote" role="status"></p>';grid.after(section);renderStats(null);}
    if(document.body.dataset.service==='consultation')void controller.entered();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(globalThis);
