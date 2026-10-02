const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8');
function harness(){
 const memory=new Map(),elements=new Map(),saved=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',style:{},classList:{add(){}},options:[],focus(){},scrollIntoView(){}});return elements.get(id);};
 const c={Deno:{env:{get:()=>''},serve(){}},console,escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},document:{getElementById:element},callBuyTestAnalyzeService:async b=>{saved.push(b);return {row:{id:'saved-id'},rows:(b.rows||[]).map((r,i)=>({...r,id:'saved-'+i}))};}};
 vm.createContext(c);vm.runInContext(server.replace(/^import .*\n/,'').replace('const document = { getElementById(){ return null; } };',''),c);
 vm.runInContext("const FORMULA_OVERRIDE_STORAGE_KEY='overrides',CUSTOM_FORMULA_STORAGE_KEY='custom';",c);
 vm.runInContext(html.slice(html.indexOf('function loadCustomFormulas('),html.indexOf('\nconst reportSeverityLabels=',html.indexOf('function loadCustomFormulas('))),c);
 vm.runInContext(html.slice(html.indexOf('const compactSeverityRank='),html.indexOf('\nfunction unknownFindingsHtml(')),c);
 return {c,element,memory,saved,run:s=>vm.runInContext(s,c)};
}
function row(extra={}){return {source_kind:'custom',source_id:'test-roof',category:'שלדת מרכב',source_text:'תיקון ייחודי בגג',classification_type:'actual_finding',report_severity:'high',meaning:'פגיעה ברכיב מבני עליון שיש לברר את היקפה.',decision:'לבדוק את חיבורי הגג ותיעוד התיקון.',question:'האם קיימות תמונות לפני התיקון?',...extra};}
function analyze(c,text,rows){return c.applyCustomRules(text,c.applyServerOverrides(c.interpretSummaryText(text),rows),rows);}
test('edit an original diagnosis moves category, edits wording and preserves individually written meaning across reload',async()=>{
 const h=harness(),{c,element,run}=h;run("globalThis.original=rawFormulaDatabase.find(row=>row.category==='מנוע');");
 c.editFormulaEntry('base',c.original.id);
 assert.equal(element('formulaText').readOnly,false);
 assert.equal(element('formulaMeaning').value,c.original.meaning||'');
 element('formulaCategory').value='מערכת ההיגוי';element('formulaText').value='נוסח אבחנה מתוקן';element('formulaMeaning').value='משמעות מדויקת שכתב המנהל';element('formulaDecision').value='בדיקה מסוימת';element('formulaSeverity').value='low';
 await c.saveCustomFormula();
 const payload=h.saved[0].row;
 assert.equal(payload.source_id,c.original.id);assert.equal(payload.source_text,'נוסח אבחנה מתוקן');assert.equal(payload.category,'מערכת ההיגוי');assert.equal(payload.meaning,'משמעות מדויקת שכתב המנהל');
 const stored=c.formulaAdminRows().find(r=>r.kind==='base'&&r.id===c.original.id);
 assert.equal(stored.text,payload.source_text);assert.equal(stored.category,payload.category);assert.equal(stored.meaning,payload.meaning);assert.equal(stored.severity,'low');
 c.editFormulaEntry('base',c.original.id);assert.equal(element('formulaMeaning').value,payload.meaning);assert.equal(element('formulaText').value,payload.source_text);
});
test('empty meaning stays empty instead of storing a repeated automatic conclusion',async()=>{
 const h=harness();h.c.newFormulaEntry();h.element('formulaCategory').value='מנוע';h.element('formulaText').value='אבחנה חדשה ללא משמעות';h.element('formulaType').value='actual_finding';h.element('formulaSeverity').value='medium';await h.c.saveCustomFormula();
 assert.equal(h.saved[0].row.meaning,'');assert.equal(h.saved[0].row.decision,'');assert.equal(h.c.loadCustomFormulas()[0].meaning,'');
});
test('failed central save leaves catalog intact and allows retry',async()=>{
 const h=harness();h.c.callBuyTestAnalyzeService=async()=>{throw Error('offline');};h.c.newFormulaEntry();h.element('formulaCategory').value='מנוע';h.element('formulaText').value='אבחנה שלא נשמרה';await h.c.saveCustomFormula();
 assert.equal(h.c.loadCustomFormulas().length,0);assert.equal(h.element('formulaSaveButton').disabled,false);assert.match(h.element('formulaAdminMessage').textContent,/לא נשמר/);
});
test('new and edited phrases are recognized and their distinct meanings reach HTML and downloadable summary',()=>{
 const h=harness(),rows=[row(),row({source_id:'test-steering',category:'מערכת ההיגוי',source_text:'ליקוי ייחודי בהיגוי',report_severity:'medium',meaning:'משמעות שונה של ליקוי בהיגוי',decision:'בדיקת מסרק ההגה',question:''})];
 const result=analyze(h.c,'שלדת מרכב\nמשמעות גבוהה: תיקון ייחודי בגג\nמערכת ההיגוי\nליקוי ייחודי בהיגוי',rows);
 const markup=h.c.compactAnalysisHtml(result),text=h.c.analysisTextBlock('סיכום',result);
 for(const r of rows){assert.ok(markup.includes(r.meaning));assert.ok(text.includes(r.meaning));assert.ok(markup.includes(r.decision));}
 assert.ok(markup.includes('categorySummaryCard high'));assert.ok(markup.includes('categorySummaryCard medium'));
});
test('an edited original still recognizes its original report phrase after a category move',()=>{
 const h=harness();const original=h.c.adminCatalog().find(r=>r.source_text==='זוויות היגוי (כיוון)')||h.c.adminCatalog().find(r=>/זוויות היגוי/.test(r.source_text));assert.ok(original);
 const override={...original,category:'צמיגים וחישוקים',source_text:'כיוון גאומטריית הגלגלים',report_severity:'low',meaning:'משמעות מקצועית ייחודית לכיוון',decision:'פעולה לכיוון'};
 const old=analyze(h.c,original.category+'\n'+original.source_text,[override]);
 const updated=old.findings.find(f=>f.managerEdited&&f.managerMeaning===override.meaning);assert.ok(updated);assert.equal(updated.category,override.category);assert.equal(updated.reportSeverity,'low');
 const fresh=analyze(h.c,'צמיגים וחישוקים\nכיוון גאומטריית הגלגלים',[override]);assert.ok(fresh.findings.some(f=>f.managerMeaning===override.meaning));
});
test('ordinary customer uses server meanings even with empty or stale local manager storage',()=>{
 const h=harness(),r=row();const result=analyze(h.c,'שלדת מרכב\nתיקון ייחודי בגג',[r]);
 h.c.saveFormulaOverrideRows([{...r,text:r.source_text,category:'מנוע',meaning:'טקסט ישן',decision:'הנחיה ישנה',report_severity:'low'}]);
 const markup=h.c.compactAnalysisHtml(result);assert.ok(markup.includes(r.meaning));assert.ok(!markup.includes('טקסט ישן'));assert.ok(markup.includes('categorySummaryCard high'));
});
test('custom wording in normal status, category heading or metadata does not create a finding',()=>{
 const {c}=harness();for(const text of ['שם הלקוח: תיקון ייחודי בגג','ללא תיקון ייחודי בגג','שלדת מרכב']){
  const r=row({source_text:text==='שלדת מרכב'?text:'תיקון ייחודי בגג'});const result=c.applyCustomRules(text,{findings:[]},[r]);assert.equal(result.findings.length,0,text);
 }
});
test('bulk category move preserves each meaning and uses stable identity on repeated moves',async()=>{
 const h=harness();h.run("globalThis.selected=rawFormulaDatabase.filter(r=>r.category==='מנוע').slice(0,2);");
 for(const item of h.c.selected)h.c.toggleFormulaAdminSelection('base',item.id,true);
 h.element('formulaBulkCategory').value='מערכת ההיגוי';await h.c.assignSelectedFormulaSubgroup();
 assert.equal(h.saved[0].rows.length,2);assert.ok(h.saved[0].rows.every(r=>r.category==='מערכת ההיגוי'&&r.meaning===''));
 for(const item of h.c.selected)h.c.toggleFormulaAdminSelection('base',item.id,true);
 h.element('formulaBulkCategory').value='צמיגים וחישוקים';await h.c.assignSelectedFormulaSubgroup();
 assert.equal(h.c.loadFormulaOverrides().length,2);assert.ok(h.c.loadFormulaOverrides().every(r=>r.category==='צמיגים וחישוקים'));
});
test('none and low overrides cannot retain a stale red safety tone',()=>{
 const {c}=harness();for(const severity of ['none','low']){
 const r=row({report_severity:severity});const out=c.applyServerOverrides({findings:[{id:'custom-test-roof',category:r.category,sourceText:r.source_text,tone:'safety',reportSeverity:'high'}]},[r]);
 assert.equal(c.compactAnalysisGroups(out)[0].severity,severity==='none'?'marginal':'low');
 }
});
