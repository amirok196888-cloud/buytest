(function(root){
'use strict';
const stages=[['free_flow_opened','פתחו את המסלול החינמי'],['free_plate_started','התחילו להזין מספר רכב'],['free_lookup_submitted','שלחו מספר לחיפוש'],['free_lookup_loaded','קיבלו נתוני רכב'],['free_questions_opened','פתחו את השאלות למוכר'],['free_license_opened','פתחו אימות רישיון']];
function createTracker({identity,send,blocked,vehicle,attribution}){
 const sent=new Set(),pending=new Map();
 async function one(eventType,id){
  const key=id.sessionId+':'+eventType;if(sent.has(key))return;if(pending.has(key))return pending.get(key);
  const task=(async()=>{try{await send({action:'track',eventType,...id,...attribution(),vehiclePlate:vehicle(),pagePath:'/free-funnel/v1'});sent.add(key);}catch(e){/* A later interaction can retry. */}finally{pending.delete(key);}})();
  pending.set(key,task);return task;
 }
 return async function track(eventType){
  if(blocked())return;
  if(!stages.some(s=>s[0]===eventType)&&!['free_lookup_failed','free_lookup_empty'].includes(eventType))return;
  const id=identity();await Promise.all(eventType==='free_flow_opened'?[one(eventType,id)]:[one('free_flow_opened',id),one(eventType,id)]);
 };
}
function render(data){
 const body=document.getElementById('analyticsFreeFunnelRows'),note=document.getElementById('analyticsFreeFunnelNote');if(!body||!note)return;
 body.replaceChildren();
 if(!data){note.textContent='מדידת ההתקדמות אינה זמינה כרגע. נסה לרענן.';return;}
 const rows=new Map((data.stages||[]).map(r=>[r.eventType,r]));
 for(const [key,label] of stages){const r=rows.get(key)||{};const tr=document.createElement('tr');for(const value of [label,Number(r.reached||0).toLocaleString('he-IL'),Number(r.last||0).toLocaleString('he-IL')]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
 const total=Number(data.total||0),complete=Number(data.completed||0);
 note.textContent=total?`${total.toLocaleString('he-IL')} ביקורים פתחו את החינמי בטווח שנבחר; ${complete.toLocaleString('he-IL')} הגיעו לשלב האחרון (${Math.round(100*complete/total)}%). ${Number(data.idleIncomplete||0).toLocaleString('he-IL')} ביקורים לא הגיעו לשלב האחרון ולא נמדדה בהם פעילות במשך 30 דקות לפחות. ביקורים עם חיפוש ללא תוצאה: ${Number(data.empty||0)}; ביקורים עם תקלת טעינה: ${Number(data.failed||0)}. המדידה החלה ב־${new Date(data.trackingStartedAt).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})}.`:'אין עדיין ביקורים שנמדדו בטווח הזה. הפירוט מתחיל מהעדכון החדש ואינו משחזר נתונים ישנים.';
}
root.BuyTestFreeFunnel={createTracker,render,stages};
if(typeof module!=='undefined')module.exports=root.BuyTestFreeFunnel;
})(typeof window!=='undefined'?window:globalThis);
