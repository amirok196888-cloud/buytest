(function(){
  'use strict';
  let version=0,files=[];
  const quality=text=>({ok:String(text).trim().length>=40,score:String(text).length,findings:0,categories:0,unknown:0});
  const allowed=()=>document.body.classList.contains('manager-mode')||Boolean(window.BuyTestBundle?.insuranceReceipt()||window.BuyTestBundle?.reportReceipt());
  function status(text){document.getElementById('externalInsuranceStatus').textContent=text;}
  function restore(){
    version++;files=[];
    document.getElementById('externalInsuranceCorrection').hidden=true;
    const source=btDossier().sources.insuranceExternal;
    document.getElementById('externalInsuranceFile').value='';
    document.getElementById('externalInsuranceText').value=source?.rawText||'';

    document.getElementById('externalInsurancePlate').textContent=plate();
    const interpretation=source?BuyTestInsurance.interpret(source.rawText||''):null;
    document.getElementById('externalInsuranceResult').textContent=interpretation?.text||'';
    document.getElementById('externalInsuranceResult').hidden=!source;
    status(source?'הפענוח שמור בסיכום לרכב הזה.':'');
  }
  async function read(input){
    if(!allowed()){await BuyTestBundle.unlock('insurance');input.value='';return;}
    const selected=Array.from(input.files||[]);if(!selected.length)return;
    const p=plate(),run=++version;
    files=[];
    document.getElementById('externalInsuranceText').value='';
    if(selected.length>6||selected.some(f=>f.size>25*1024*1024)||selected.reduce((n,f)=>n+f.size,0)>40*1024*1024){status('אפשר לצרף עד 6 קבצים, עד 25MB לקובץ ו־40MB בסך הכול.');return;}
    if(selected.some(f=>!(f.type.startsWith('image/')||f.type==='application/pdf'))){status('אפשר להעלות PDF או תמונה בלבד.');return;}
    let worker;
    try{
      status('קורא את דוח העבר הביטוחי...');
      const parts=[];
      for(const file of selected){
        const prepared=file.type==='application/pdf'?await pdfForDocumentOcr(file,quality,12,true):{sources:await imageForDocumentOcr(file)};
        let text=prepared.text||'';
        if(!text&&prepared.sources?.length){
          if(googleVisionReady())try{text=await googleVisionRecognize(prepared.sources);}catch(_){}
          if(!quality(text).ok){
            if(!window.Tesseract)throw new Error('OCR_UNAVAILABLE');
            worker=worker||await Tesseract.createWorker('heb+eng');
            const result=await recognizeDocumentSources(worker,prepared.sources,document.getElementById('externalInsuranceStatus'),()=>{},quality);
            text=result.text||'';
          }
        }
        if(!quality(text).ok)throw new Error('TEXT_NOT_FOUND');
        parts.push('קובץ: '+file.name+'\n'+text);
      }
      if(run!==version||p!==plate())return;
      files=selected.map(f=>f.name);
      document.getElementById('externalInsuranceText').value=parts.join('\n\n');
      save();
    }catch(error){
      if(run===version&&p===plate()){document.getElementById('externalInsuranceCorrection').hidden=false;document.getElementById('externalInsuranceCorrection').open=true;status(error.message==='PDF_TOO_LONG'?'ה־PDF ארוך מ־12 עמודים. פצל אותו לקבצים לפני ההעלאה.':'לא הצלחנו לקרוא את הדוח במלואו. נסה PDF מקורי או צילום ברור; אפשר גם להדביק למטה את הטקסט מהדוח.');}
    }finally{if(worker)await worker.terminate();}
  }
  function save(){
    if(!allowed()){void BuyTestBundle.unlock('insurance');return;}
    const p=plate(),text=document.getElementById('externalInsuranceText').value.trim();
    if(!/^\d{7,8}$/.test(p)){status('יש להזין מספר רכב.');return;}
    if(!quality(text).ok){status('יש להעלות דוח קריא או להדביק את תוכנו לפני השמירה.');return;}
    if(text.length>80000){status('הטקסט ארוך מדי. יש לצרף את פרטי הרכב ואת פרטי התביעות והנזקים עד 80,000 תווים.');return;}
    const labelled=Array.from(text.matchAll(/(?:מספר\s*(?:רכב|רישוי)|מס[׳'״"]?\s*רכב|license\s*plate)\s*[:\-]?\s*([\d\- ]{7,12})/gi)).map(m=>m[1].replace(/\D/g,'')).filter(x=>/^\d{7,8}$/.test(x));
    if(labelled.some(x=>x!==p)){status('נמצא בטקסט מספר רכב אחר. בדוק את דוח המקור ואת זיהוי הטקסט לפני השמירה.');return;}
    const interpretation=BuyTestInsurance.interpret(text);
    btSaveSource('insuranceExternal',{title:'פענוח עבר ביטוחי — דוח שהלקוח העלה',rawText:text,files:[...files],text:interpretation.text,alerts:interpretation.alerts,mileage:[],interpretationVersion:2});
    status(interpretation.status==='incomplete'?'הדוח נקרא, אך חסרים פרטי תביעות קריאים. העלה את טבלת התביעות והנזקים.':'✓ דוח העבר הביטוחי פוענח ושולב בסיכום לרכב '+p+'.');
    document.getElementById('externalInsuranceResult').textContent=interpretation.text;
    document.getElementById('externalInsuranceResult').hidden=false;
  }
  function remove(){
    if(!allowed())return;
    const dossier=btDossier();delete dossier.sources.insuranceExternal;
    try{localStorage.setItem('buytest-dossier-v1:'+plate(),JSON.stringify(dossier));}catch(_){dossier.storageFailed=true;}
    restore();btRefreshSummary();status('הדוח החיצוני הוסר מהסיכומים.');
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const panel=document.createElement('section');panel.id='externalInsurancePanel';panel.className='uploadPanel btExternalInsurance';
    panel.innerHTML='<h3>כבר יש לך דוח עבר ביטוחי?</h3><button type="button" class="primary full" id="externalInsuranceChoose" style="margin-top:12px">העלאת דוח עבר ביטוחי</button><p class="sub">יש לך דוח מגורם אחר? צרף PDF או צילום של טבלת התביעות והנזקים, כולל כותרות העמודות.</p><input type="file" id="externalInsuranceFile" accept="image/*,application/pdf" multiple hidden><p id="externalInsuranceStatus" role="status" aria-live="polite"></p><div class="info" id="externalInsuranceResult" hidden style="white-space:pre-line"></div><details id="externalInsuranceCorrection" hidden><summary>השלמת פרטים מהדוח</summary><label for="externalInsuranceText">טקסט שנקרא מהדוח</label><textarea id="externalInsuranceText" class="reportInput" rows="8" style="color:#17352d;background:#fff"></textarea><p>הפענוח ישויך לרכב <b id="externalInsurancePlate"></b>.</p><button type="button" class="primary full" id="externalInsuranceSave">עדכון פענוח העבר הביטוחי</button><button type="button" class="secondary full" id="externalInsuranceRemove">הסרת הדוח החיצוני</button></details>';
    document.querySelector('#afterInspectionSection .afterGrid').insertAdjacentElement('afterend',panel);
    document.getElementById('externalInsuranceChoose').onclick=()=>document.getElementById('externalInsuranceFile').click();
    document.getElementById('externalInsuranceFile').onchange=function(){void read(this);};
    document.getElementById('externalInsuranceSave').onclick=save;
    document.getElementById('externalInsuranceRemove').onclick=remove;
    const activate=btActivateVehicle;
    btActivateVehicle=function(p){const changed=p!==btDossierPlate;activate(p);if(changed)restore();};

    restore();
  });
})();
