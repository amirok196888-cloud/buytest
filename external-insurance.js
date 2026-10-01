(function(){
  'use strict';
  let version=0,files=[];
  const quality=text=>({ok:String(text).trim().length>=40,score:String(text).length,findings:0,categories:0,unknown:0});
  const allowed=()=>document.body.classList.contains('manager-mode')||Boolean(window.BuyTestBundle?.reportReceipt());
  function status(text){document.getElementById('externalInsuranceStatus').textContent=text;}
  function restore(){
    version++;files=[];
    const source=btDossier().sources.insuranceExternal;
    document.getElementById('externalInsuranceFile').value='';
    document.getElementById('externalInsuranceText').value=source?.rawText||'';
    document.getElementById('externalInsuranceConfirm').checked=false;
    document.getElementById('externalInsurancePlate').textContent=plate();
    status(source?'הדוח שהעלית שמור בסיכום לרכב הזה.':'');
  }
  async function read(input){
    if(!allowed()){await BuyTestBundle.unlock('report');input.value='';return;}
    const selected=Array.from(input.files||[]);if(!selected.length)return;
    const p=plate(),run=++version;
    files=[];document.getElementById('externalInsuranceConfirm').checked=false;
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
      status('הטקסט נקרא. בדוק מול דוח המקור, תקן לפי הצורך ואשר את שיוך הדוח לרכב לפני השמירה.');
    }catch(error){
      if(run===version&&p===plate())status(error.message==='PDF_TOO_LONG'?'ה־PDF ארוך מ־12 עמודים. פצל אותו לקבצים לפני ההעלאה.':'לא הצלחנו לקרוא את הדוח במלואו. נסה PDF מקורי או צילום ברור; אפשר גם להדביק למטה את הטקסט מהדוח.');
    }finally{if(worker)await worker.terminate();}
  }
  function save(){
    if(!allowed()){void BuyTestBundle.unlock('report');return;}
    const p=plate(),text=document.getElementById('externalInsuranceText').value.trim();
    if(!/^\d{7,8}$/.test(p)){status('יש להזין מספר רכב.');return;}
    if(!quality(text).ok){status('יש להעלות דוח קריא או להדביק את תוכנו לפני השמירה.');return;}
    if(text.length>80000){status('הטקסט ארוך מדי. יש לצרף את פרטי הרכב ואת פרטי התביעות והנזקים עד 80,000 תווים.');return;}
    if(!document.getElementById('externalInsuranceConfirm').checked){status('יש לוודא ולאשר שהדוח שייך לרכב '+p+'.');return;}
    const labelled=Array.from(text.matchAll(/(?:מספר\s*(?:רכב|רישוי)|מס[׳'״"]?\s*רכב|license\s*plate)\s*[:\-]?\s*([\d\- ]{7,12})/gi)).map(m=>m[1].replace(/\D/g,'')).filter(x=>/^\d{7,8}$/.test(x));
    if(labelled.some(x=>x!==p)){status('נמצא בטקסט מספר רכב אחר. בדוק את דוח המקור ואת זיהוי הטקסט לפני השמירה.');return;}
    btSaveSource('insuranceExternal',{title:'עבר ביטוחי — דוח חיצוני שהלקוח העלה',rawText:text,files:[...files],text:'מקור: דוח חיצוני שהלקוח העלה ואישר כי שייך לרכב '+p+'. הטקסט נקרא אוטומטית או הוזן ותוקן בידי הלקוח; יש לאמת מול דוח המקור.\n'+text,alerts:[],mileage:[]});
    status('דוח העבר הביטוחי החיצוני נשמר ושולב בסיכומים לרכב '+p+'.');
  }
  function remove(){
    if(!allowed())return;
    const dossier=btDossier();delete dossier.sources.insuranceExternal;
    try{localStorage.setItem('buytest-dossier-v1:'+plate(),JSON.stringify(dossier));}catch(_){dossier.storageFailed=true;}
    restore();btRefreshSummary();status('הדוח החיצוני הוסר מהסיכומים.');
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const panel=document.createElement('details');panel.className='uploadPanel';panel.id='externalInsurancePanel';
    panel.innerHTML='<summary><b>כבר יש לך דוח עבר ביטוחי? העלאה מגורם אחר</b></summary><p>אפשר לצרף PDF או צילום של דוח שקיבלת. אין צורך להזמין דוח נוסף כדי לשלב אותו בסיכום. עד 6 קבצים; עד 12 עמודים בכל PDF.</p><button type="button" class="secondary full" id="externalInsuranceChoose">העלאת דוח עבר ביטוחי קיים</button><input type="file" id="externalInsuranceFile" accept="image/*,application/pdf" multiple hidden><p id="externalInsuranceStatus" role="status" aria-live="polite"></p><label for="externalInsuranceText">טקסט הדוח — לבדיקה ותיקון מול המקור</label><textarea id="externalInsuranceText" class="reportInput" rows="8" style="color:#17352d;background:#fff" placeholder="אפשר גם להדביק כאן את הטקסט מדוח העבר הביטוחי"></textarea><label style="display:flex;gap:8px;align-items:start"><input type="checkbox" id="externalInsuranceConfirm" style="width:auto"><span>בדקתי מול המקור: הדוח שייך לרכב <b id="externalInsurancePlate"></b>, והטקסט תואם לדוח.</span></label><button type="button" class="primary full" id="externalInsuranceSave">שמירת הדוח ושילובו בסיכום</button><button type="button" class="secondary full" id="externalInsuranceRemove">הסרת הדוח החיצוני</button>';
    document.querySelector('#afterInspectionSection .afterGrid').append(panel);
    document.getElementById('externalInsuranceChoose').onclick=()=>document.getElementById('externalInsuranceFile').click();
    document.getElementById('externalInsuranceFile').onchange=function(){void read(this);};
    document.getElementById('externalInsuranceSave').onclick=save;
    document.getElementById('externalInsuranceRemove').onclick=remove;
    const activate=btActivateVehicle;
    btActivateVehicle=function(p){const changed=p!==btDossierPlate;activate(p);if(changed)restore();};
    restore();
  });
})();
