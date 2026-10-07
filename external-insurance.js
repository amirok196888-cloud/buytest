(function(){
  'use strict';
  let version=0,files=[],pendingFiles=[];
  const quality=text=>({ok:String(text).trim().length>=40,score:String(text).length,findings:0,categories:0,unknown:0});
  const allowed=()=>/^\d{7,8}$/.test(plate());
  function status(text){const element=document.getElementById('externalInsuranceStatus');if(element)element.textContent=text;}
  function restore(){
    version++;files=[];pendingFiles=[];
    const interpretButton=document.getElementById('externalInsuranceInterpret');if(interpretButton)interpretButton.disabled=true;
    document.getElementById('externalInsuranceCorrection').hidden=true;
    const source=allowed()?btDossier().sources.insuranceExternal:null;
    document.getElementById('externalInsuranceFile').value='';
    document.getElementById('externalInsuranceText').value=source?.rawText||'';

    const interpretation=source?BuyTestInsurance.interpret(source.rawText||''):null;
    document.getElementById('externalInsuranceResult').textContent=interpretation?.text||'';
    document.getElementById('externalInsuranceResult').hidden=!source;
    status(source?'הפענוח שמור בסיכום לרכב הזה.':'');
  }
  async function read(input){
    const selected=Array.from(input.files||[]);input.value='';if(!selected.length)return;
    version++;files=[];pendingFiles=[];
    document.getElementById('externalInsuranceText').value='';
    const button=document.getElementById('externalInsuranceInterpret');
    if(selected.length>6||selected.some(f=>f.size>25*1024*1024)||selected.reduce((n,f)=>n+f.size,0)>40*1024*1024){if(button)button.disabled=true;status('אפשר לצרף עד 6 קבצים, עד 25MB לקובץ ו־40MB בסך הכול.');return;}
    if(selected.some(f=>!(f.type.startsWith('image/')||f.type==='application/pdf'))){if(button)button.disabled=true;status('אפשר להעלות PDF או תמונה בלבד.');return;}
    pendingFiles=selected;
    if(button)button.disabled=false;
    status(selected.length===1?'הקובץ נבחר. לחץ על „פענח את הדוח”.':selected.length+' קבצים נבחרו. לחץ על „פענח את הדוח”.');
  }
  async function interpretPending(){
    if(!pendingFiles.length)return;
    const selected=pendingFiles.slice(),p=plate(),run=++version;
    files=[];
    const button=document.getElementById('externalInsuranceInterpret');
    if(button)button.disabled=true;
    document.getElementById('externalInsuranceText').value='';
    let worker;
    try{
      status('קורא את קובץ הדוח במכשיר...');
      const parts=[];
      for(const file of selected){
        const prepared=file.type==='application/pdf'?await pdfForDocumentOcr(file,quality,12,true):{sources:await imageForDocumentOcr(file)};
        let text=prepared.text||'';
        if(!quality(text).ok&&prepared.sources?.length){
          if(!window.Tesseract)throw new Error('OCR_UNAVAILABLE');
          worker=worker||await Tesseract.createWorker('heb+eng');
          const result=await recognizeDocumentSources(worker,prepared.sources,document.getElementById('externalInsuranceStatus'),()=>{},quality);
          text=result.text||'';
        }
        if(!quality(text).ok)throw new Error('TEXT_NOT_FOUND');
        parts.push('קובץ: '+file.name+'\\n'+text);
      }
      if(run!==version||p!==plate())return;
      files=selected.map(f=>f.name);
      document.getElementById('externalInsuranceText').value=parts.join('\\n\\n');
      pendingFiles=[];
      save();
    }catch(error){
      if(run===version&&p===plate()){
        if(button)button.disabled=!pendingFiles.length;
        document.getElementById('externalInsuranceCorrection').hidden=false;
        document.getElementById('externalInsuranceCorrection').open=true;
        status(error.message==='PDF_TOO_LONG'?'ה־PDF ארוך מ־12 עמודים. פצל אותו לקבצים לפני ההעלאה.':error.message==='PDF_UNAVAILABLE'?'קורא ה‑PDF לא נטען במכשיר. לא הועלה קובץ; אפשר להדביק למטה את הטקסט מהדוח.':error.message==='OCR_UNAVAILABLE'?'מנוע זיהוי הטקסט לא נטען במכשיר. לא הועלה קובץ; אפשר להדביק למטה את הטקסט מהדוח.':'לא הצלחנו לקרוא את הדוח במלואו. נסה PDF מקורי או צילום ברור; אפשר גם להדביק למטה את הטקסט מהדוח.');
      }
    }finally{if(worker)await worker.terminate();}
  }
  function save(){
    const p=plate(),text=document.getElementById('externalInsuranceText').value.trim();
    if(p&&!/^\d{7,8}$/.test(p)){status('מספר הרכב שהוזן אינו מלא. אפשר למחוק אותו ולהמשיך בלי שיוך לרכב, או להזין 7 או 8 ספרות.');return;}
    if(!quality(text).ok){status('יש להעלות דוח קריא או להדביק את תוכנו לפני השמירה.');return;}
    if(text.length>80000){status('הטקסט ארוך מדי. יש לצרף את פרטי הרכב ואת פרטי התביעות והנזקים עד 80,000 תווים.');return;}
    const labelled=Array.from(text.matchAll(/(?:מספר\s*(?:רכב|רישוי)|מס[׳'״"]?\s*רכב|license\s*plate)\s*[:\-]?\s*([\d\- ]{7,12})/gi)).map(m=>m[1].replace(/\D/g,'')).filter(x=>/^\d{7,8}$/.test(x));
    if(p&&labelled.some(x=>x!==p)){status('נמצא בטקסט מספר רכב אחר. בדוק את דוח המקור ואת זיהוי הטקסט לפני השמירה.');return;}
    const interpretation=BuyTestInsurance.interpret(text);
    if(p)btSaveSource('insuranceExternal',{title:'פענוח דוח העבר הביטוחי — קובץ שהלקוח העלה',rawText:text,files:[...files],text:interpretation.text,alerts:interpretation.alerts,mileage:[],interpretationVersion:2});
    status(interpretation.status==='incomplete'?'הדוח נקרא, אך חסרים פרטי תביעות קריאים. העלה את טבלת התביעות והנזקים.':p?'✓ דוח העבר הביטוחי פוענח ושולב בסיכום לרכב '+p+'.':'✓ דוח העבר הביטוחי פוענח. התוצאה מוצגת כאן.');
    document.getElementById('externalInsuranceResult').textContent=interpretation.text;
    document.getElementById('externalInsuranceResult').hidden=false;
  }
  function remove(){
    if(!allowed())return;
    const dossier=btDossier();delete dossier.sources.insuranceExternal;
    try{localStorage.setItem('buytest-dossier-v1:'+plate(),JSON.stringify(dossier));}catch(_){dossier.storageFailed=true;}
    restore();btRefreshSummary();status('דוח העבר הביטוחי הוסר מהסיכומים.');
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const panel=document.createElement('section');panel.id='externalInsurancePanel';panel.className='btExternalInsurance';panel.style.cssText='margin:0;padding:0;border:0;background:transparent;box-shadow:none';
    panel.innerHTML='<button type="button" class="primary full" id="externalInsuranceChoose" style="margin-top:12px">בחירת קובץ מהטלפון</button><button type="button" class="primary full" id="externalInsuranceInterpret" style="margin-top:10px" disabled>פענח את הדוח</button><p class="sub">הורד את הדוח לטלפון, בחר את קובץ ה‑PDF או התמונה, ו‑BuyTest תפענח אותו כאן. הקובץ נקרא במכשיר ואינו נשלח לבלק״ר.</p><input type="file" id="externalInsuranceFile" accept="image/*,application/pdf" multiple hidden><p id="externalInsuranceStatus" role="status" aria-live="polite"></p><div class="info" id="externalInsuranceResult" hidden style="white-space:pre-line"></div><details id="externalInsuranceCorrection" hidden><summary>השלמת פרטים מהדוח</summary><label for="externalInsuranceText">טקסט שנקרא מהדוח</label><textarea id="externalInsuranceText" class="reportInput" rows="8" style="color:#17352d;background:#fff"></textarea><p>מספר רכב אינו חובה. אם נבחר רכב קודם, הפענוח יצורף לסיכום שלו.</p><button type="button" class="primary full" id="externalInsuranceSave">עדכון פענוח דוח העבר הביטוחי</button><button type="button" class="secondary full" id="externalInsuranceRemove">הסרת דוח העבר הביטוחי</button></details>';
    const mount=document.getElementById('externalInsuranceMount');
    if(mount) mount.append(panel);
    document.getElementById('externalInsuranceChoose').onclick=()=>document.getElementById('externalInsuranceFile').click();
    document.getElementById('externalInsuranceFile').onchange=function(){void read(this);};
    document.getElementById('externalInsuranceInterpret').onclick=()=>void interpretPending();
    document.getElementById('externalInsuranceSave').onclick=save;
    document.getElementById('externalInsuranceRemove').onclick=remove;
    const activate=btActivateVehicle;
    btActivateVehicle=function(p){const changed=p!==btDossierPlate;activate(p);if(changed)restore();};

    restore();
  });
})();
