const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8');
function engine(){const c={Deno:{env:{get:()=>''},serve(){}},console,escapeHtml:String};vm.createContext(c);vm.runInContext(server.replace(/^import .*\n/,''),c);vm.runInContext(html.slice(html.indexOf('const compactSeverityRank='),html.indexOf('\nfunction unknownFindingsHtml(')),c);vm.runInContext(html.slice(html.indexOf('function btPdfAnalysisCards('),html.indexOf('\nfunction btPdfExceptionCards(')),c);return c;}
// Artificial line breaks in existing public catalog phrases; no uploaded report fixture.
test('wrapped brake diagnosis is one complete fact in both summary and PDF',()=>{
 const c=engine();for(const text of ['צלחות בלם\nשחוקות','צלחות\nבלם שחוקות']){
  const result=c.interpretSummaryText('מערכת הבלמים (ללא פירוק גלגלים)\n'+text),groups=c.compactAnalysisGroups(result);
  assert.equal(groups.length,1);assert.deepEqual(Array.from(groups[0].bullets),['צלחות בלם שחוקות']);
  const pdf=c.btPdfAnalysisCards(result);assert.equal(pdf.length,1);assert.equal(pdf[0].card.bullets[0],'צלחות בלם שחוקות');
  assert.ok(!result.findings.some(f=>(f.sourceText||f.matchedTerm)==='שחוקות'));
 }
});
test('punctuation separates diagnoses while physical wraps within a clause do not',()=>{
 const c=engine();for(const separator of [',',';','.','!','?','•']){
  assert.deepEqual(Array.from(c.reportLines('צלחות בלם'+separator+'\nשחוקות')),['צלחות בלם','שחוקות']);
 }
 assert.deepEqual(Array.from(c.reportLines('לפרק גלגלים לבדיקה, צלחות בלם\nשחוקות. צמיגים פגומים')),['לפרק גלגלים לבדיקה','צלחות בלם שחוקות','צמיגים פגומים']);
 assert.deepEqual(Array.from(c.reportLines('מערכת ההיגוי\nתקין')),['מערכת ההיגוי','תקין']);
 assert.deepEqual(Array.from(c.reportLines('צלחות בלם\nמערכת הקירור\nשחוקות')),['צלחות בלם','מערכת הקירור','שחוקות']);
});
test('wrapped oil instruction remains under engine and retains the saved manager explanation',()=>{
 const c=engine(),row={source_kind:'observed',source_id:'sample-004',source_text:'לבדוק תצרוכת שמן בנסיעה',category:'מנוע',report_severity:'none',classification_type:'limitation_or_disclaimer',meaning:'הסבר מנהל לבדיקה',question:'בירור מנהל שמור',active:true};
 for(const phrase of ['לבדוק תצרוכת\nשמן בנסיעה','לבדוק תצרוכת שמן\nבנסיעה','לבדוק\nתצרוכת שמן\nבנסיעה']){
  const text='מערכת הקירור\n'+phrase,result=c.applyCustomRules(text,c.applyServerOverrides(c.interpretSummaryText(text,[row]),[row]),[row]),groups=c.compactAnalysisGroups(result);
  assert.equal(groups.length,1);assert.equal(groups[0].category,'מנוע ומערכות נלוות');assert.equal(groups[0].details[0].fact,row.source_text);assert.equal(groups[0].details[0].meaning,row.meaning);
  const pdf=c.btPdfAnalysisCards(result);assert.ok(pdf[0].card.bullets.includes(row.source_text));assert.match(pdf[0].card.bullets.join(' '),/הסבר מנהל לבדיקה/);
 }
});
test('normal wrapped status does not turn a component name into a defect',()=>{
 const c=engine();assert.equal(c.interpretSummaryText('מערכת הבלמים (ללא פירוק גלגלים)\nצלחות בלם\nתקינות').findings.length,0);
});
test('high significance paragraphs keep complete clauses and explicit punctuation boundaries',()=>{
 const c=engine(),text='שלדת מרכב\nמשמעות גבוהה: רכב לאחר תאונה\nקשה, סימני הלחמות וחיבורים\nלא מקוריים בגוף הרכב. תיקון משקופים\nמשמעות נמוכה: תיקוני פח וצבע';
 const result=c.interpretSummaryText(text),conclusion=c.professionalOverallConclusion(result);
 assert.match(conclusion.highConclusion,/רכב לאחר תאונה קשה/);assert.match(conclusion.highConclusion,/סימני הלחמות וחיבורים לא מקוריים בגוף הרכב/);assert.match(conclusion.highConclusion,/תיקון משקופים/);
 assert.ok(!conclusion.highConclusion.includes('תיקוני פח וצבע'));assert.match(conclusion.lowConclusion,/תיקוני פח וצבע/);
 const body=c.compactAnalysisGroups(result).filter(g=>g.category==='שלדה ומרכב'&&g.severity==='high');
 assert.equal(body.length,1);assert.deepEqual(Array.from(body[0].bullets),['רכב לאחר תאונה קשה','סימני הלחמות וחיבורים לא מקוריים בגוף הרכב','תיקון משקופים']);
 assert.deepEqual(Array.from(c.reportLines('צלחות בלם\n\nשחוקות')),['צלחות בלם','שחוקות']);
});
test('shared clause joining stays identical in browser and server',()=>{
 for(const name of ['reportWrappedContinuation','reportLines','interpretSummaryText']){const extract=s=>{const start=s.indexOf('function '+name+'(');return s.slice(start,s.indexOf('\n}\n',start)+3);};assert.equal(extract(html),extract(server));}
});
