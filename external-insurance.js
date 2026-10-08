(function(){
  'use strict';
  let version=0,files=[],pendingFiles=[];
  const quality=text=>({ok:String(text).trim().length>=40,score:String(text).length,findings:0,categories:0,unknown:0});
  const allowed=()=>/^\d{7,8}$/.test(plate());
  function status(text){const element=document.getElementById('externalInsuranceStatus');if(element)element.textContent=text;}
  function visionFailureMessage(error){
    const code=String(error?.message||'');
    if(code==='PDF_TOO_LONG')return 'ה־PDF ארוך מ־12 עמודים. פצל אותו לקבצים לפני ההעלאה.';
    if(code==='PDF_UNAVAILABLE')return 'קורא ה‑PDF לא נטען. לא נשמר פענוח חלקי.';
    if(code==='GOOGLE_VISION_PROXY_MISSING')return 'שירות הפענוח אינו מוגדר כרגע. לא נשמר פענוח חלקי; אפשר לנסות שוב מאוחר יותר.';
    const http=code.match(/^GOOGLE_VISION_PROXY_FAILED_(\d{3})$/);
    if(http){
      const n=Number(http[1]);
      if(n===429)return 'שירות Google Vision עמוס כרגע. לא נשמר פענוח חלקי; נסה שוב בעוד כמה דקות.';
      if(n===401||n===403)return 'שירות הפענוח דחה את הבקשה. לא נשמר פענוח חלקי; יש לבדוק את הגדרת השירות.';
      if(n>=500)return 'שירות הפענוח אינו זמין כרגע. לא נשמר פענוח חלקי; נסה שוב בעוד כמה דקות.';
      return 'הקובץ נדחה על ידי שירות הפענוח (שגיאה '+n+'). בדוק שהקובץ הוא PDF או תמונה תקינים.';
    }
    if(code.startsWith('GOOGLE_VISION_INCOMPLETE_'))return 'Google Vision לא הצליח לקרוא את כל עמודי הדוח. לא נשמר פענוח חלקי; נסה PDF מקורי או צילום חד, ישר ומלא יותר.';
    if(code==='VISION_LOW_QUALITY')return 'הקובץ התקבל, אך הטקסט שנקרא אינו מספיק לפענוח אמין. נסה PDF מקורי או צילום חד, ישר ומלא יותר.';
    if(code==='GOOGLE_VISION_PAGES_MISSING')return 'לא נמצאו עמודים תקינים בקובץ. בדוק את הקובץ ונסה שוב.';
    return 'לא הצלחנו להשלים את הפענוח. לא נשמר פענוח חלקי; נסה שוב עם PDF מקורי או צילום חד וישר יותר.';
  }
  function renderInterpretation(interpretation){
 const host=document.getElementById('externalInsuranceResult');if(!host)return;host.replaceChildren();host.hidden=true;
}
function reset(){
    version++;files=[];pendingFiles=[];
    const file=document.getElementById('externalInsuranceFile');if(file)file.value='';
    const text=document.getElementById('externalInsuranceText');if(text)text.value='';
    const correction=document.getElementById('externalInsuranceCorrection');if(correction){correction.hidden=true;correction.open=false;}
    const button=document.getElementById('externalInsuranceInterpret');if(button)button.disabled=true;
    const result=document.getElementById('externalInsuranceResult');if(result){result.replaceChildren();result.hidden=true;}
    status('');
  }
  window.BuyTestExternalInsurance={reset,getCurrent(){const text=document.getElementById('externalInsuranceText')?.value.trim()||'';return {text,busy:pendingFiles.length>0,interpretation:text?BuyTestInsurance.interpret(text):null};},async prepare(){if(pendingFiles.length){const ok=await interpretPending();if(!ok)throw new Error('insurance_ocr_failed');}return this.getCurrent();},commit(){return save();}};
  function restore(){
    version++;files=[];pendingFiles=[];
    const interpretButton=document.getElementById('externalInsuranceInterpret');if(interpretButton)interpretButton.disabled=true;
    document.getElementById('externalInsuranceCorrection').hidden=true;
    const source=allowed()?btDossier().sources.insuranceExternal:null;
    document.getElementById('externalInsuranceFile').value='';
    document.getElementById('externalInsuranceText').value=source?.rawText||'';

    const interpretation=source?BuyTestInsurance.interpret(source.rawText||''):null;
    renderInterpretation(interpretation);
    document.getElementById('externalInsuranceResult').hidden=!source;
    status(source?'דוח העבר הביטוחי נשמר במכשיר.':'');
  }
  async function read(input){
    const selected=Array.from(input.files||[]);input.value='';if(!selected.length)return;
    version++;files=[];pendingFiles=[];
    document.getElementById('externalInsuranceText').value='';
    const oldResult=document.getElementById('externalInsuranceResult');if(oldResult){oldResult.replaceChildren();oldResult.hidden=true;}
    if(allowed()){
      const dossier=btDossier();delete dossier.sources.insuranceExternal;
      try{localStorage.setItem('buytest-dossier-v1:'+plate(),JSON.stringify(dossier));}catch(_){dossier.storageFailed=true;}
      btRefreshSummary();
    }
    const button=document.getElementById('externalInsuranceInterpret');
    if(selected.length>6||selected.some(f=>f.size>25*1024*1024)||selected.reduce((n,f)=>n+f.size,0)>40*1024*1024){if(button)button.disabled=true;status('אפשר לצרף עד 6 קבצים, עד 25MB לקובץ ו־40MB בסך הכול.');return;}
    if(selected.some(f=>!(f.type.startsWith('image/')||f.type==='application/pdf'))){if(button)button.disabled=true;status('אפשר להעלות PDF או תמונה בלבד.');return;}
    pendingFiles=selected;
    if(button)button.disabled=false;
    status('הקובץ נבחר. אחרי העלאת הדוחות לחץ על „פענוח דוחות” כדי להתחיל בפענוח המשותף.');
  }
  async function interpretPending(){
    if(!pendingFiles.length)return;
    const selected=pendingFiles.slice(),p=plate(),run=++version;
    files=[];
    const button=document.getElementById('externalInsuranceInterpret');
    if(button)button.disabled=true;
    document.getElementById('externalInsuranceText').value='';
    try{
      status('מכין עמודים לשליחה ל־Google Vision...');
      const parts=[];
      for(const file of selected){
        const prepared=file.type==='application/pdf'
          ? await pdfForDocumentOcr(file,quality,12,true,true)
          : {text:'',sources:[],visionSources:await imageForGoogleVision(file)};
        const visionSources=prepared.visionSources||prepared.sources||[];
        if(!visionSources.length)throw new Error('GOOGLE_VISION_PAGES_MISSING');
        const text=await googleVisionRecognize(visionSources,document.getElementById('externalInsuranceStatus'));
        if(!quality(text).ok)throw new Error('VISION_LOW_QUALITY');
        parts.push('קובץ: '+file.name+'\n'+text);
      }
      if(run!==version||p!==plate())return false;
      files=selected.map(f=>f.name);
      document.getElementById('externalInsuranceText').value=parts.join('\n\n');
      pendingFiles=[];
      status('הקובץ נקרא. הממצאים יוצגו בסיכום המשותף.');
      return true;
    }catch(error){
      if(run===version&&p===plate()){
        if(button)button.disabled=!pendingFiles.length;
        document.getElementById('externalInsuranceCorrection').hidden=false;
        document.getElementById('externalInsuranceCorrection').open=true;
        status(visionFailureMessage(error));
      }
      return false;
    }
  }
  function save(){
    const p=plate(),text=document.getElementById('externalInsuranceText').value.trim();
    if(!text)return true;
    if(p&&!/^\d{7,8}$/.test(p)){status('מספר הרכב אינו מלא. אפשר להסירו או להזין 7 או 8 ספרות.');return false;}
    if(!quality(text).ok){status('הקובץ לא נקרא ברמת דיוק מספקת. יש להעלות PDF מקורי או צילום חד, ישר ומלא יותר.');return false;}
    if(text.length>80000){status('הטקסט ארוך מדי. יש לצרף את פרטי הרכב ואת פרטי התביעות והנזקים עד 80,000 תווים.');return false;}
    const labelled=Array.from(text.matchAll(/(?:מספר\s*(?:רכב|רישוי)|מס[׳'״"]?\s*רכב|license\s*plate)\s*[:\-]?\s*([\d\- ]{7,12})/gi)).map(m=>m[1].replace(/\D/g,'')).filter(x=>/^\d{7,8}$/.test(x));
    if(p&&labelled.some(x=>x!==p)){status('נמצא בקובץ מספר רכב אחר. בדוק את דוח המקור ואת המספר לפני הפענוח.');return false;}
    const interpretation=BuyTestInsurance.interpret(text);
    if(p)btSaveSource('insuranceExternal',{title:'פענוח דוח העבר הביטוחי — קובץ שהלקוח העלה',rawText:text,files:[...files],text:interpretation.text,alerts:interpretation.alerts,mileage:[],interpretationVersion:3});
    status(interpretation.status==='incomplete'?'הדוח נקרא, אך חסרים פרטי תביעות קריאים. העלה את טבלת התביעות והנזקים.':p?'✓ דוח העבר הביטוחי פוענח ושולב בסיכום לרכב '+p+'.':'✓ דוח העבר הביטוחי פוענח. התוצאה מוצגת כאן.');
    renderInterpretation(interpretation);
    return true;
  }
  function remove(){
    if(!allowed())return;
    const dossier=btDossier();delete dossier.sources.insuranceExternal;
    try{localStorage.setItem('buytest-dossier-v1:'+plate(),JSON.stringify(dossier));}catch(_){dossier.storageFailed=true;}
    restore();btRefreshSummary();status('דוח העבר הביטוחי הוסר מהסיכומים.');
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const panel=document.createElement('section');panel.id='externalInsurancePanel';panel.className='btExternalInsurance';panel.style.cssText='margin:0;padding:0;border:0;background:transparent;box-shadow:none';
    panel.innerHTML='<button type="button" class="primary full" id="externalInsuranceChoose" style="margin-top:12px">העלאת קובץ עבר ביטוחי</button><p class="sub">העלה את הדוח שהורדת. הקובץ ייקרא עם בחירתו, והממצאים יוצגו בסיכום לאחר פענוח הדוחות.</p><input type="file" id="externalInsuranceFile" accept="image/*,application/pdf" multiple hidden><p id="externalInsuranceStatus" role="status" aria-live="polite"></p><div class="info" id="externalInsuranceResult" hidden style="white-space:pre-line"></div><details id="externalInsuranceCorrection" hidden><summary>השלמת פרטים מהדוח</summary><label for="externalInsuranceText">טקסט שנקרא מהדוח</label><textarea id="externalInsuranceText" class="reportInput" rows="8" style="color:#17352d;background:#fff"></textarea><p>מספר רכב אינו חובה. אם נבחר רכב קודם, הפענוח יצורף לסיכום שלו.</p><button type="button" class="primary full" id="externalInsuranceSave">עדכון פענוח דוח העבר הביטוחי</button><button type="button" class="secondary full" id="externalInsuranceRemove">הסרת דוח העבר הביטוחי</button></details>';
    const mount=document.getElementById('externalInsuranceMount');
    if(mount) mount.append(panel);
    document.getElementById('externalInsuranceChoose').onclick=()=>document.getElementById('externalInsuranceFile').click();
    document.getElementById('externalInsuranceFile').onchange=function(){void read(this);};
    document.getElementById('externalInsuranceInterpret')?.addEventListener('click',()=>void interpretPending());
    document.getElementById('externalInsuranceSave').onclick=save;
    document.getElementById('externalInsuranceRemove').onclick=remove;
    const activate=btActivateVehicle;
    btActivateVehicle=function(p){const changed=p!==btDossierPlate;activate(p);if(changed)restore();};

    restore();
  });
})();
