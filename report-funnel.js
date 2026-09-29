(function(root){
'use strict';
const stages=[['report_opened','פתחו פענוח דוח'],['report_file_selected','בחרו קובץ דוח'],['report_read_ready','הדוח נקרא בהצלחה'],['report_analyze_clicked','לחצו על התחלת הפענוח'],['report_analysis_started','הפענוח התחיל בפועל'],['report_result_received','התקבלה תשובה תקינה'],['report_result_displayed','התוצאה הוצגה באתר']];
const errors=['report_read_failed','report_validation_blocked','report_analysis_failed','report_result_discarded'];
function createTracker({identity,send,blocked,vehicle,attribution}){
 const sent=new Set(),pending=new Map();
 async function one(eventType,id){
  const key=id.sessionId+':'+eventType;if(sent.has(key))return;if(pending.has(key))return pending.get(key);
  const task=(async()=>{try{await send({action:'track',eventType,...id,vehiclePlate:null,pagePath:'/report-funnel/v1'});sent.add(key);}catch(e){/* A later interaction can retry. */}finally{pending.delete(key);}})();
  pending.set(key,task);return task;
 }
 function capture(){return {...identity(),...attribution()};}
 async function track(eventType,context){
  if(blocked())return;
  if(!stages.some(s=>s[0]===eventType)&&!errors.includes(eventType))return;
  const id=context||capture();
  await one('report_opened',id);
  if(eventType!=='report_opened')await one(eventType,id);
 }
 track.capture=capture;return track;
}

function render(data){
 const body=document.getElementById('analyticsReportFunnelRows'),note=document.getElementById('analyticsReportFunnelNote');if(!body||!note)return;
 body.replaceChildren();
 if(!data){note.textContent='מדידת ההתקדמות אינה זמינה כרגע. נסה לרענן.';return;}
 const rows=new Map((data.stages||[]).map(r=>[r.eventType,r]));
 for(const [key,label] of stages){const r=rows.get(key)||{};const tr=document.createElement('tr');for(const value of [label,Number(r.reached||0).toLocaleString('he-IL'),Number(r.last||0).toLocaleString('he-IL')]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
 const total=Number(data.total||0),complete=Number(data.completed||0);
 note.textContent=total?`${total.toLocaleString('he-IL')} ביקורים פתחו פענוח; ב־${complete.toLocaleString('he-IL')} הוצגה תוצאה (${Math.round(100*complete/total)}%). טרם הוצגה תוצאה ב־${Number(data.incomplete||0)} ביקורים. תקלת קריאת קובץ: ${Number(data.readFailed||0)}; חסר מידע או אישור: ${Number(data.blocked||0)}; תקלת פענוח: ${Number(data.failed||0)}; תשובה שלא הוצגה עקב החלפת רכב: ${Number(data.discarded||0)}. ביקור עשוי לכלול תקלה ובהמשך הצלחה. המדידה החדשה החלה ב־${new Date(data.trackingStartedAt).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})}.`:'אין עדיין פעילות בטווח הזה. המדידה החדשה אינה משחזרת פענוחים ישנים.';

}
root.BuyTestReportFunnel={createTracker,render,stages};
if(typeof module!=='undefined')module.exports=root.BuyTestReportFunnel;
})(typeof window!=='undefined'?window:globalThis);
