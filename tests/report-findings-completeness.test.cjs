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
