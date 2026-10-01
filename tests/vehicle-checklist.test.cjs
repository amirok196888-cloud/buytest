const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function summary(sources,preliminary){
  const context={btDossier:()=>({plate:'12345678',sources}),btSummaryAlerts:d=>Object.values(d.sources).flatMap(s=>s.alerts||[]),Date};
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function btUnifiedEntries('),html.indexOf('function btRefreshSummary(')),context);
  return context.btUnifiedEntries({preliminary}).map(e=>e.text).join('\n');
}
test('preliminary summary excludes inspection findings and its warnings even after report interpretation',()=>{
  const sources={checklist:{title:'דיווח הקונה',text:'צבע שונה בדלת',alerts:['לבירור: צבע']},inspection:{title:'פענוח דוח המכון',text:'ממצא מכון',alerts:['אזהרת המכון']}};
  const initial=summary(sources,true),final=summary(sources,false);
  assert.match(initial,/צבע שונה בדלת/);assert.match(initial,/לבירור: צבע/);
  assert.doesNotMatch(initial,/ממצא מכון|אזהרת המכון/);
  assert.match(final,/ממצא מכון/);assert.match(final,/אזהרת המכון/);
});
test('direct report summary explicitly marks absent preliminary sources',()=>{
  const text=summary({inspection:{title:'דוח המכון',text:'ממצא מהמכון'}},false);
  for(const label of ['נתוני מאגר הרישוי','צ׳קליסט ליד הרכב','השוואת צילום הרישיון','עבר ביטוחי'])assert.ok(text.includes(label+': לא התקבל מידע'));
  assert.match(text,/אין להסיק מכך שהרכב תקין/);
});
test('combined summary preserves every source and identifies buyer and seller reports as unverified',()=>{
  const sources=Object.fromEntries(['registry','checklist','license','insurance','notes','inspection'].map(key=>[key,{title:key,text:'source:'+key}]));
  const text=summary(sources,false);
  for(const key of Object.keys(sources))assert.ok(text.includes('source:'+key));
  assert.match(text,/תשובות המוכר והבדיקה העצמית הן דיווחי המשתמש/);
});
test('missing inspection mileage does not produce a false zero-kilometre discrepancy, including legacy dossiers',()=>{
  const context={btDossier:()=>({sources:{registry:{mileage:[{km:63556,date:'2026-02-19',source:'מאגר רישוי'}]},inspection:{mileage:[{km:0,source:'דוח המכון'}]}}}),fmtNum:String,Date};
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function btMileage('),html.indexOf('function btSourceLines(')),context);
  vm.runInContext(html.slice(html.indexOf('function btSummaryAlerts('),html.indexOf('function btUnifiedEntries(')),context);
  assert.equal(context.btSummaryAlerts().length,0);
});
test('external insurance appears in both summaries and satisfies the insurance information source',()=>{
  const sources={insuranceExternal:{title:'עבר ביטוחי — דוח חיצוני שהלקוח העלה',text:'נזק לדלת לפי דוח הלקוח'}};
  for(const preliminary of [true,false]){
    const text=summary(sources,preliminary);assert.match(text,/נזק לדלת לפי דוח הלקוח/);assert.doesNotMatch(text,/עבר ביטוחי: לא התקבל מידע/);
  }
});
