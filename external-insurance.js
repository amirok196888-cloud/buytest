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
    const host=document.getElementById('externalInsuranceResult');
    if(!host)return;
    host.replaceChildren();
    if(!interpretation){host.hidden=true;return;}
    host.hidden=false;
    const style=document.createElement('style');
    style.textContent='.btInsuranceResult{direction:rtl;text-align:right;color:#19352f;min-width:0}.btInsuranceResult h3{margin:0 0 12px;color:#075e49}.btInsuranceMeta,.btInsuranceStats,.btInsuranceEvent{border:1px solid #d7e5e0;border-radius:14px;background:#fff;padding:14px;margin:10px 0;min-width:0}.btInsuranceStats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:8px}.btInsuranceStat{border-radius:10px;background:#f0f8f5;padding:8px 10px;min-width:0;overflow-wrap:anywhere}.btInsuranceStat strong{display:block;font-size:1.15em}.btInsuranceClaim{border:1px solid #dce6e2;border-radius:12px;background:#fff;padding:12px;margin:10px 0;min-width:0}.btInsuranceClaim dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;margin:0}.btInsuranceField{min-width:0}.btInsuranceField dt{font-size:.9em;color:#526963;margin-bottom:3px}.btInsuranceField dd{margin:0;font-weight:650;overflow-wrap:anywhere;line-height:1.5}.btInsuranceAlert{border-right:4px solid #d19a25;background:#fff8e8;border-radius:8px;padding:10px;margin:8px 0;overflow-wrap:anywhere}.btInsuranceCaution{color:#425b55;line-height:1.65;margin-top:14px}.btInsuranceRaw{margin-top:14px}.btInsuranceRaw pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;direction:rtl;text-align:right}.btInsuranceUnparsed{white-space:pre-line;overflow-wrap:anywhere}@media(max-width:520px){.btInsuranceClaim dl{grid-template-columns:minmax(0,1fr)}}';
    host.append(style);
    const box=document.createElement('div');box.className='btInsuranceResult';
    const title=document.createElement('h3');title.textContent='אלה הממצאים שנמצאו בדוח';box.append(title);
    const meta=document.createElement('div');meta.className='btInsuranceMeta';
    const vehicle=document.createElement('div');vehicle.textContent='מספר רכב בדוח: '+(interpretation.plate||'לא זוהה בקובץ');meta.append(vehicle);
    if(interpretation.queryDate){const query=document.createElement('div');query.textContent='תאריך השאילתה בדוח: '+interpretation.queryDate;meta.append(query);}
    box.append(meta);
    const summary=interpretation.summary||{};
    const stats=document.createElement('div');stats.className='btInsuranceStats';
    const statValues=[
      ['מועדים לפי תאריך',summary.eventCount],
      ['תביעות ייחודיות',summary.claimCount],
      ['שורות מקור',summary.sourceRecordCount],
      ['תביעות לרכב המבוטח',summary.insuredClaims],
      ['תביעות צד ג׳',summary.thirdPartyClaims],
      ['אובדן גמור/להלכה',summary.totalLossClaims],
      ...(summary.unlinkedTotalLoss?[['אזכור אובדן שלא שויך',1]]:[]),
      ['שורות עם נתוני ירידת ערך/תשלום',summary.depreciationClaims],
      ['גניבה/פריצה',summary.theftClaims]
    ];
    statValues.forEach(([label,value])=>{
      if(value===undefined)return;
      const stat=document.createElement('div');stat.className='btInsuranceStat';
      const number=document.createElement('strong');number.textContent=String(value);
      const caption=document.createElement('span');caption.textContent=label;
      stat.append(number,caption);stats.append(stat);
    });
    box.append(stats);
    if(interpretation.events?.length){
      interpretation.events.forEach(event=>{
        const section=document.createElement('section');section.className='btInsuranceEvent';
        const heading=document.createElement('h4');heading.textContent='ממצאים לפי תאריך: '+(event.date||'לא נקרא');section.append(heading);
        event.claims.forEach(claim=>{
          const card=document.createElement('article');card.className='btInsuranceClaim';
          const amountText=claim.amounts?.length?claim.amounts.map(value=>'₪'+value).join(' · '):'לא נקראו';
          const depreciation=claim.depreciationRate||((claim.amounts?.length>1)?'סכום מופיע; שיוך לא נקרא':'לא צוין');
          const statusText=(claim.status||'לא נקרא')+(claim.recordCount>1?' · '+claim.recordCount+' שורות מקור':'');
          const fields=[
            ['מספר תביעה',claim.claimNumber||'לא נקרא'],
            ['מספר פוליסה',claim.policyNumber||'לא נקרא'],
            ['סוג התביעה',claim.party||'לא נקרא'],
            ['סוג הנזק / הרישום',claim.damage||'לא נקרא'],
            ['סכומים שנקראו מהטבלה',amountText],
            ['ירידת ערך',depreciation],
            ['מצב התביעה',statusText],
            ['חברת הביטוח',claim.insurer||'לא נקראה']
          ];
          const list=document.createElement('dl');
          fields.forEach(([label,value])=>{
            const item=document.createElement('div');item.className='btInsuranceField';
            const term=document.createElement('dt');term.textContent=label;
            const detail=document.createElement('dd');detail.textContent=String(value);
            item.append(term,detail);list.append(item);
          });
          card.append(list);section.append(card);
        });
        box.append(section);
      });
    }else{
      const unparsed=document.createElement('p');unparsed.className='btInsuranceUnparsed';unparsed.textContent=interpretation.text||'לא נמצאו פרטי תביעה קריאים.';
      box.append(unparsed);
    }
    (interpretation.alerts||[]).forEach(message=>{
      const alert=document.createElement('div');alert.className='btInsuranceAlert';alert.textContent=message;box.append(alert);
    });
    const caution=document.createElement('p');caution.className='btInsuranceCaution';
    caution.textContent='הדוח מציג תביעות שדווחו לחברות הביטוח. תיקונים פרטיים, תיקונים שלא דרך הביטוח או תיקונים במוסך לא מורשה עלולים שלא להופיע בו. היעדר רישום אינו שולל נזק או תאונה, ובדיקה במכון עדיין מומלצת.';
    box.append(caution);
    if(interpretation.rawText){
      const details=document.createElement('details');details.className='btInsuranceRaw';
      const summaryLabel=document.createElement('summary');summaryLabel.textContent='הטקסט שנקרא מהקובץ — להצגת מקור הפענוח';
      const pre=document.createElement('pre');pre.textContent=interpretation.rawText;
      details.append(summaryLabel,pre);box.append(details);
    }
    host.append(box);
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
  window.BuyTestExternalInsurance={reset};
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
    status(source?'הפענוח שמור בסיכום לרכב הזה.':'');
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
    status(selected.length===1?'הקובץ נבחר. לחץ על „פענח את הדוח”.':selected.length+' קבצים נבחרו. לחץ על „פענח את הדוח”.');
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
      if(run!==version||p!==plate())return;
      files=selected.map(f=>f.name);
      document.getElementById('externalInsuranceText').value=parts.join('\n\n');
      pendingFiles=[];
      save();
    }catch(error){
      if(run===version&&p===plate()){
        if(button)button.disabled=!pendingFiles.length;
        document.getElementById('externalInsuranceCorrection').hidden=false;
        document.getElementById('externalInsuranceCorrection').open=true;
        status(visionFailureMessage(error));
      }
    }
  }
  function save(){
    const p=plate(),text=document.getElementById('externalInsuranceText').value.trim();
    if(p&&!/^\d{7,8}$/.test(p)){status('מספר הרכב שהוזן אינו מלא. אפשר למחוק אותו ולהמשיך בלי שיוך לרכב, או להזין 7 או 8 ספרות.');return;}
    if(!quality(text).ok){status('יש להעלות דוח קריא או להדביק את תוכנו לפני השמירה.');return;}
    if(text.length>80000){status('הטקסט ארוך מדי. יש לצרף את פרטי הרכב ואת פרטי התביעות והנזקים עד 80,000 תווים.');return;}
    const labelled=Array.from(text.matchAll(/(?:מספר\s*(?:רכב|רישוי)|מס[׳'״"]?\s*רכב|license\s*plate)\s*[:\-]?\s*([\d\- ]{7,12})/gi)).map(m=>m[1].replace(/\D/g,'')).filter(x=>/^\d{7,8}$/.test(x));
    if(p&&labelled.some(x=>x!==p)){status('נמצא בטקסט מספר רכב אחר. בדוק את דוח המקור ואת זיהוי הטקסט לפני השמירה.');return;}
    const interpretation=BuyTestInsurance.interpret(text);
    if(p)btSaveSource('insuranceExternal',{title:'פענוח דוח העבר הביטוחי — קובץ שהלקוח העלה',rawText:text,files:[...files],text:interpretation.text,alerts:interpretation.alerts,mileage:[],interpretationVersion:3});
    status(interpretation.status==='incomplete'?'הדוח נקרא, אך חסרים פרטי תביעות קריאים. העלה את טבלת התביעות והנזקים.':p?'✓ דוח העבר הביטוחי פוענח ושולב בסיכום לרכב '+p+'.':'✓ דוח העבר הביטוחי פוענח. התוצאה מוצגת כאן.');
    renderInterpretation(interpretation);
  }
  function remove(){
    if(!allowed())return;
    const dossier=btDossier();delete dossier.sources.insuranceExternal;
    try{localStorage.setItem('buytest-dossier-v1:'+plate(),JSON.stringify(dossier));}catch(_){dossier.storageFailed=true;}
    restore();btRefreshSummary();status('דוח העבר הביטוחי הוסר מהסיכומים.');
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const panel=document.createElement('section');panel.id='externalInsurancePanel';panel.className='btExternalInsurance';panel.style.cssText='margin:0;padding:0;border:0;background:transparent;box-shadow:none';
    panel.innerHTML='<button type="button" class="primary full" id="externalInsuranceChoose" style="margin-top:12px">בחירת קובץ מהטלפון</button><button type="button" class="primary full" id="externalInsuranceInterpret" style="margin-top:10px" disabled>פענח את הדוח</button><p class="sub">הורד את הדוח לטלפון, בחר את קובץ ה‑PDF או התמונה. עמודי הדוח יישלחו דרך שירות מאובטח של BuyTest ל‑Google Vision לפענוח. BuyTest אינה מתחברת לבלק״ר.</p><input type="file" id="externalInsuranceFile" accept="image/*,application/pdf" multiple hidden><p id="externalInsuranceStatus" role="status" aria-live="polite"></p><div class="info" id="externalInsuranceResult" hidden style="white-space:pre-line"></div><details id="externalInsuranceCorrection" hidden><summary>השלמת פרטים מהדוח</summary><label for="externalInsuranceText">טקסט שנקרא מהדוח</label><textarea id="externalInsuranceText" class="reportInput" rows="8" style="color:#17352d;background:#fff"></textarea><p>מספר רכב אינו חובה. אם נבחר רכב קודם, הפענוח יצורף לסיכום שלו.</p><button type="button" class="primary full" id="externalInsuranceSave">עדכון פענוח דוח העבר הביטוחי</button><button type="button" class="secondary full" id="externalInsuranceRemove">הסרת דוח העבר הביטוחי</button></details>';
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
