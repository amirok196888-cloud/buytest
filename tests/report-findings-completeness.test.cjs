const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const server=fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8');
const html=fs.readFileSync('index.html','utf8');
function engine(){
 const c={Deno:{env:{get:()=>''},serve(){}},console,escapeHtml:s=>String(s)};
 vm.createContext(c);vm.runInContext(server.replace(/^import .*\n/,''),c);
 vm.runInContext(html.slice(html.indexOf('const compactSeverityRank='),html.indexOf('\nfunction compactAnalysisHtml(')),c);
 return c;
}
// Transcribed diagnostic column from the user's 57249 photo, not an invented diagnosis.
const report=`מנוע
לבדוק מעקב טיפולים,לבדוק צריכת שמן בנסיעה,רעש מערכת שסתומים
מערכת מתלה קדמי
נקישות מתלה קדמי בוקסות פגומות
מערכת ההיגוי
זוויות היגוי (כיוון)
מערכת הבלמים (ללא פירוק גלגלים)
לפרק גלגלים לבדיקה,נמצאו תקלות סריקת מחשב לבדוק במוסך
צמיגים וחישוקים
צמיגים פגומים
שלדת מרכב
משמעות גבוהה: רכב לאחר תאונה קשה,תיקונים בגג עם מילוי חומר,תיקון משקופים,סימני הלחמות וחיבורים לא מקוריים בגוף הרכב,תיקונים מעמוד שמאלי קדמי,לבדוק ירידת ערך עם שמאי רכב
משמעות נמוכה: סימני פגיעה במרכב,כנף קדמית שמאלית הוחלפה,פגוש קדמי,הוחלפו חלקי מרכב,בוצעו תיקוני פח וצבע סביב למרכב עם מילוי חומר,שריטות מעיכות סביב,פגמי צבע,מגש אחורי חסר,מראה שמאל לא מתקפלת
הערות כלליות
אין אחריות על תיבת הילוכים אוטומטית`;
test('severe accident and every structural diagnosis survive into red conclusion',()=>{
 const c=engine(),r=c.interpretSummaryText(report),summary=c.professionalOverallConclusion(r);
 for(const phrase of ['רכב לאחר תאונה קשה','תיקונים בגג עם מילוי חומר','תיקון משקופים','סימני הלחמות וחיבורים לא מקוריים בגוף הרכב','תיקונים מעמוד שמאלי קדמי','לבדוק ירידת ערך עם שמאי רכב']){
  assert.ok(summary.highConclusion.includes(phrase),phrase);
 }
 const groups=c.compactAnalysisGroups(r),steering=groups.find(g=>g.category==='מערכת ההיגוי');
 assert.ok(steering.bullets.some(s=>s.includes('זוויות היגוי')));
 assert.ok(groups.some(g=>g.bullets.some(s=>s.includes('בוקסות פגומות'))));
 assert.ok(!r.findings.some(f=>/אין אחריות על תיבת/.test(f.sourceText||'')));
 assert.ok(!summary.highConclusion.includes('כנף קדמית שמאלית הוחלפה'));
 assert.match(summary.lowConclusion,/כנף קדמית שמאלית הוחלפה/);
 const markup=c.professionalOverallConclusionHtml(r);
 assert.match(markup,/meaningConclusion high/);assert.match(markup,/meaningConclusion medium/);assert.match(markup,/meaningConclusion low/);
});
test('wrapped severe accident is preserved, category and severity boundaries stop lookahead',()=>{
 const c=engine();const r=c.interpretSummaryText('מנוע\nתקין\nשלדת מרכב\nמשמעות גבוהה: רכב לאחר תאונה\nקשה, תיקון משקופים\nמשמעות נמוכה: תיקוני פח וצבע\nמערכת ההיגוי\nזוויות היגוי (כיוון)');
 const s=c.professionalOverallConclusion(r);
 assert.match(s.highConclusion,/רכב לאחר תאונה קשה/);
 assert.match(s.highConclusion,/תיקון משקופים/);
 assert.ok(!s.highConclusion.includes('תיקוני פח וצבע'));
 assert.ok(!r.findings.some(f=>f.category==='מנוע'));
});
test('no absent low findings are fabricated and generic table status is not diagnosed',()=>{
 const c=engine(),r=c.interpretSummaryText('מנוע\nתקין\nמערכת ההיגוי\nתקין\nשלדת מרכב\nמשמעות גבוהה: רכב לאחר תאונה קשה');
 assert.equal(c.professionalOverallConclusion(r).lowConclusion,'');
 assert.ok(!r.findings.some(f=>/מנוע|היגוי/.test(f.category)));
});
test('browser and server parser stay identical',()=>{
 const extract=s=>s.slice(s.indexOf('function interpretSummaryText(text){'),s.indexOf('\nconst dtcStatusDefinitions=',s.indexOf('function interpretSummaryText(text){')));
 assert.equal(extract(html),extract(server));
});

test('body impact after tyres remains a body finding even without the body heading',()=>{
 const c=engine();
 for(const phrase of ['סימני פגיעה מאחור','סימני פגיעה בחזית','סימני פגיעה במרכב']){
  const r=c.interpretSummaryText('צמיגים וחישוקים\nצמיגים פגומים, '+phrase);
  const body=r.findings.find(f=>f.sourceText===phrase);
  assert.equal(body?.category,'שלדת מרכב',phrase);
  assert.ok(!r.findings.some(f=>/צמיג/.test(f.category)&&String(f.sourceText).includes(phrase)));
  assert.ok(r.findings.some(f=>/צמיג/.test(f.category)));
  const groups=c.compactAnalysisGroups(r);
  assert.ok(groups.some(g=>/שלד|מרכב/.test(g.category)&&g.bullets.includes(phrase)));
  assert.ok(!groups.some(g=>/צמיג/.test(g.category)&&g.bullets.some(b=>b.includes(phrase))));
 }
});
test('body impact preserves explicit severity and separate chassis without assuming damage severity',()=>{
 const c=engine();
 const r=c.interpretSummaryText('צמיגים וחישוקים\nמשמעות נמוכה: סימני פגיעה מאחור');
 assert.equal(r.findings.find(f=>f.sourceText==='סימני פגיעה מאחור')?.reportSeverity,'low');
 const plain=c.interpretSummaryText('צמיגים וחישוקים\nסימני פגיעה מאחור');
 assert.notEqual(plain.findings[0].reportSeverity,'high');
 assert.equal(c.interpretSummaryText('שלדה נפרדת\nסימני פגיעה מאחור').findings[0].category,'שלדה נפרדת');
 const tyre=c.interpretSummaryText('צמיגים וחישוקים\nצמיגים אחוריים פגומים');
 assert.ok(tyre.findings.every(f=>/צמיג/.test(f.category)));
});
test('previously misclassified body impact is corrected when rendering a saved result',()=>{
 const c=engine();
 const groups=c.compactAnalysisGroups({findings:[{id:'report-diagnosis-1',category:'צמיגים וחישוקים',sourceText:'סימני פגיעה מאחור',observedText:'סימני פגיעה מאחור',verbatimDiagnosis:true,classification:'source_diagnosis',reportSeverity:'low'}]});
 assert.equal(groups.length,1);assert.match(groups[0].category,/שלד|מרכב/);
});

test('explicit body heading retains rear impact even when OCR joins its words',()=>{
 const c=engine();
 for(const phrase of ['סימני פגיעה מאחור','סימני פגיעהמאחור','סימניפגיעהמאחור']){
  const r=c.interpretSummaryText('צמיגים וחישוקים\nצמיגים פגומים\nשלדת מרכב\nמשמעות נמוכה: '+phrase);
  const impact=r.findings.find(f=>f.sourceText===phrase);
  assert.equal(impact?.category,'שלדת מרכב');assert.equal(impact.reportSeverity,'low');
  const g=c.compactAnalysisGroups(r).find(g=>g.bullets.includes(phrase));
  assert.equal(g?.category,'שלדה ומרכב');
  const legacy=c.compactAnalysisGroups({findings:[{...impact,category:'צמיגים וחישוקים'}]});
  assert.equal(legacy[0].category,'שלדה ומרכב');
 }
});
