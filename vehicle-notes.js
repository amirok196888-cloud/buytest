(function(){
'use strict';
const core=window.BuyTestVehicleNotesCore;
let generation=0,controller=null,catalogPromise=null;
const disclaimer='המידע מבוסס על פרסומים של המקורות המצוינים בנוגע לתופעות שתועדו בחלק מכלי הרכב מהדגם או מהגרסה. אין בכך לקבוע שהתקלה קיימת ברכב זה או שתופיע בו בעתיד. יש לבדוק כל רכב לגופו, בהתאם למצבו, לאופי השימוש ולהיסטוריית הטיפולים שלו.';
function node(tag,text,cls){const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
function source(parent,text,url){try{const u=new URL(url);if(u.protocol!=='https:')return;const a=node('a',text);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}catch{}}
function clear(){generation++;controller?.abort();const box=document.getElementById('vehicleAttention');if(box){box.hidden=true;box.replaceChildren();}}
function card(item){
 const {entry:e,uncertain}=item;const d=node('details',null,'vehicleNote');
 d.append(node('summary',e.title));
 if(uncertain)d.append(node('p','התאמת הגרסה עדיין לא אומתה — '+e.scope,'vehicleNoteScope'));
 else d.append(node('p',e.scope,'vehicleNoteScope'));
 d.append(node('p',e.description),node('p','שאל את המוכר: '+e.ask),node('p','מומלץ לבדוק: '+e.check));
 const meta=node('p',e.region+' · נבדק בתאריך '+e.reviewed+' · ','vehicleNoteMeta');source(meta,e.source,e.url);d.append(meta);return d;
}
async function load(record,options){
 clear();const current=generation;controller=new AbortController();const requestController=controller;const signal=requestController.signal;
 const box=document.getElementById('vehicleAttention');if(!box||!core)return;
 const v=core.identity(record);if(!v.year)return;
 box.hidden=false;box.append(node('h3','נקודות לתשומת לב בבדיקת הרכב'),node('p',disclaimer,'vehicleNoteDisclaimer'));
 const local=node('div');const online=node('div');box.append(local,online);
 local.append(node('p','טוען מידע מתועד לדגם…','vehicleNoteStatus'));
 const localTask=(async()=>{
  try{
   if(!catalogPromise)catalogPromise=fetch('data/vehicle-notes.json?v=1',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{catalogPromise=null;throw e;});
   const catalog=await catalogPromise;if(current!==generation)return;
   const matches=catalog.entries.map(e=>core.match(e,v)).filter(Boolean);local.replaceChildren();
   if(!matches.length)local.append(node('p','עדיין אין במאגר שלנו מידע מאומת שמתאים לגרסה הזאת. אין בכך להעיד על תקינות הרכב.','vehicleNoteStatus'));
   matches.forEach(m=>local.append(card(m)));
  }catch{if(current===generation)local.replaceChildren(node('p','המידע מהמאגר אינו זמין כרגע. אפשר להמשיך בבדיקה.','vehicleNoteStatus'));}
 })();
 // Never send plates, VINs, owner identity or the raw ministry record upstream.
 let model=v.model||(/^[a-z0-9 .-]+$/i.test(v.rawModel)?v.rawModel:'');
 if(v.model==='Ioniq')model=/חשמל/.test(v.fuel)&&!/(בנזין|היבריד)/.test(v.fuel)?'Ioniq Electric':/(בנזין|היבריד)/.test(v.fuel)?'Ioniq Hybrid':'';
 if(!v.make||!model){online.append(node('p','אין כרגע התאמה מספקת למקור האונליין עבור הגרסה הזאת.','vehicleNoteStatus'));await localTask;return;}
 const state=node('p','בודק גם קריאות שירות במקור ציבורי בחו״ל…','vehicleNoteStatus');state.setAttribute('role','status');online.append(state);
 const timeout=setTimeout(()=>requestController.abort(),20000);
 try{
  const response=await fetch(options.endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':options.key,'Authorization':'Bearer '+options.key},body:JSON.stringify({make:v.make,model,year:v.year}),signal});
  if(!response.ok)throw Error();const data=await response.json();if(current!==generation)return;
  online.replaceChildren();
  if(data.status!=='ok'){online.append(node('p','מקור האונליין לא מצא התאמה לדגם ולשנתון. זו אינה קביעה שאין תקלות או קריאות שירות.','vehicleNoteStatus'));return;}
  const details=node('details',null,'vehicleNoteOnline');details.append(node('summary','קריאות שירות מחו״ל — '+data.items.length+' רשומות'));
  details.append(node('p','הנתונים מתייחסים לשוק האמריקאי ולדגם, ולא לרכב שלך לפי מספר שלדה. יש לאמת תחולה והשלמת טיפול מול היבואן בישראל. קריאת שירות אינה מדד לשכיחות תקלות.'));
  if(!data.items.length)details.append(node('p','לא הוחזרו קריאות שירות מהמקור הזה. אין בכך אישור לתקינות הרכב או להיעדר קריאות בישראל.'));
  for(const r of data.items){const item=node('details',null,'vehicleNote');item.append(node('summary','קריאת שירות '+r.id));item.append(node('p','מסמך המקור באנגלית:'));for(const key of ['component','summary','consequence','remedy']){const p=node('p',r[key]);p.dir='ltr';p.lang='en';item.append(p);}details.append(item);}
  const foot=node('p','מקור: NHTSA · נבדק: '+new Date(data.checkedAt).toLocaleString('he-IL'),'vehicleNoteMeta');source(foot,' מידע על המקור','https://www.nhtsa.gov/recalls');details.append(foot);online.append(details);
 }catch{if(current===generation)online.replaceChildren(node('p','בדיקת האונליין אינה זמינה כרגע. המידע המתועד שמוצג לעיל נשאר זמין ואפשר להמשיך.','vehicleNoteStatus'));}
 finally{clearTimeout(timeout);await localTask;}
}
window.BuyTestVehicleNotes={load,clear};
})();
