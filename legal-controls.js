/* Legal notices and optional advertising consent. No service or diagnosis rules. */
(function(root){
  'use strict';
  const marketingKey='buytestMarketingConsentV1';
  const noticeVersion='2026-10-11';
  function canTrack(){
    if(root.BuyTestInternalTraffic?.blocked())return false;
    try{return root.localStorage.getItem(marketingKey)==='yes';}catch(_){return false;}
  }
  function requireUpload(id){
    if(id==='insuranceLegalAccept'&&root.document.body?.dataset.service==='report')id='inspectionOwnership';
    const input=root.document.getElementById(id);
    if(input?.checked)return true;
    root.alert('לפני העלאת מסמך יש לקרוא ולאשר את ההבהרות המשפטיות ומדיניות הפרטיות, ולוודא שיש לך הרשאה לעיבוד המסמך.');
    input?.scrollIntoView({block:'center'});input?.focus();
    return false;
  }
  function clearLocal(){
    if(!root.confirm('למחוק את תיקי הרכב השמורים בדפדפן זה? מידע בשרת וקבצים שהורדו לא יימחקו.'))return;
    try{
      const keys=[];
      for(let i=0;i<root.localStorage.length;i++){const k=root.localStorage.key(i);if(k?.startsWith('buytest-dossier-v1:'))keys.push(k);}
      keys.forEach(k=>root.localStorage.removeItem(k));
      root.location.reload();
    }catch(_){root.alert('לא ניתן למחוק את אחסון הדפדפן כרגע. אפשר לנקות את נתוני האתר דרך הגדרות הדפדפן.');}
  }
  root.BuyTestLegal={canTrack,requireUpload,noticeVersion};
  root.document.addEventListener('DOMContentLoaded',()=>{
    root.document.querySelectorAll('[data-buytest-marketing-consent]').forEach(input=>{
      input.checked=canTrack();
      input.addEventListener('change',()=>{
        try{root.localStorage.setItem(marketingKey,input.checked?'yes':'no');root.location.reload();}
        catch(_){input.checked=false;root.alert('לא ניתן לשמור את בחירת המעקב. כלי הפרסום יישארו כבויים.');}
      });
    });
    root.document.querySelectorAll('[data-buytest-clear-local]').forEach(button=>button.addEventListener('click',clearLocal));
    for(const id of ['inspectionOwnership','insuranceLegalAccept','licenseLegalAccept']){
      const input=root.document.getElementById(id);
      input?.addEventListener('change',()=>{
        try{root.sessionStorage.setItem('buytestLegalAcceptance:'+id,JSON.stringify({accepted:input.checked,version:noticeVersion,at:new Date().toISOString()}));}catch(_){}
      });
    }
    // A shared insurance panel moves between routes; one approval is enough in the combined flow.
    const insurance=root.document.getElementById('insuranceLegalAccept');
    if(insurance){
      const sync=()=>{insurance.closest('.legalConsent').hidden=root.document.body.dataset.service==='report';};
      sync();new MutationObserver(sync).observe(root.document.body,{attributes:true,attributeFilter:['data-service']});
    }
  });
})(globalThis);
