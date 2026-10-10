const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8');
function engine(){
 const c={Deno:{env:{get:()=>''},serve(){}},console,escapeHtml:String};vm.createContext(c);vm.runInContext(server.replace(/^import .*\n/,''),c);
 for(const [start,end] of [['function inspectionVisionWords(','async function inspectionVisionText('],['function ocrComparisonLines(','\nfunction cleanOcrText('],['const compactSeverityRank=','\nfunction unknownFindingsHtml('],['function btPdfAnalysisCards(','\nfunction btPdfExceptionCards(']])vm.runInContext(html.slice(html.indexOf(start),html.indexOf(end)),c);
 return c;
}
// Anonymous diagnostic clauses, independently generated table coordinates.
// No customer identity, vehicle numbers, uploaded image or original OCR response.
const expected=[
 'לבדוק מעקב טיפולים','לבדוק תצרוכת שמן בנסיעה','זוויות היגוי (כיוון)',
 'לפרק גלגלים לבדיקה','צלחות בלם שחוקות','צמיגים קדמיים יבשים וסדוקים','מנורת לחץ אוויר דולקת',
 'תיקוני תאונה צד שמאל ומאחור','פגיעה בעמוד אמצעי צד שמאל','ריתוכים לא מקוריים מאחור בסף ובקורת שלדה ובכנף אחורי מולחם',
 'הוחלפו דלתות צד שמאל','הוחלף מכסה תא מטען','הוחלפו חלקי מרכב','תיקוני פחחות וצבע עם מילוי חומר',
 'מעיכות ושריטות סביב הרכב','תיקון כיפוף פגושים','שמשה קדמית הוחלפה','תיקון פח אחורי'
];
function table(){
 const words=[];const add=(text,x,y)=>words.push({symbols:Array.from(text,text=>({text})),boundingBox:{vertices:[{x,y},{x:x+Math.max(6,text.length*5),y},{x:x+Math.max(6,text.length*5),y:y+10},{x,y:y+10}]}});
 add('האבחנה',200,15);add('תקין',520,15);add('תקין',600,15);add('המערכת',810,15);
 const rows=[
 ['מנוע',['לבדוק מעקב טיפולים, לבדוק תצרוכת','שמן בנסיעה,']],
 ...['מערכת הקירור','מערכת דלק','מערכת הצתה','מערכת גידוש המנוע','מערכות הנעה','מערכת הטעינה','מערכת הפליטה ומערכות למניעת זיהום אוויר','מערכת ההתנעה (כולל מצבר)','מצמד','תיבת הילוכים','תיבת העברת הכוח','ציריות/גל הינע','מערכת מתלה קדמי','מערכת מתלה אחורי'].map(category=>[category,[]]),
 ['מערכת ההיגוי',['זוויות היגוי (כיוון)']],
 ['מערכת הבלמים (ללא פירוק גלגלים)',['לפרק גלגלים לבדיקה, צלחות בלם','שחוקות']],
 ['צמיגים וחישוקים',['צמיגים קדמיים יבשים וסדוקיםמנורת לחץ','אוויר דולקת']],
 ['שלדת מרכב',[
 'משמעות גבוהה: : תיקוני תאונה צד שמאל','ומאחור, פגיעה בעמוד אמצעי צד שמאל,','ריתוכים לא מקוריים מאחור בסף ובקורת','שלדה ובכנף אחורי מולחם',
 'משמעות נמוכה: : הוחלפו דלתות צד','שמאל, הוחלף מכסה תא מטען, הוחלפו','חלקי מרכב, תיקוני פחחות וצבע עם מילוי','חומר, מעיכות ושריטות סביב הרכב, תיקון','כיפוף פגושים,, שמשה קדמית הוחלפה,','תיקון פח אחורי,']],
 ['מערכת תאורה',[]]
 ];
 const borders=[0,35];let y=35;
 rows.forEach(([category,lines],index)=>{
  // System names may span physical lines inside the same table row.
  const heading=category.split(' ');let x=945;
  heading.forEach((word,i)=>{const width=word.length*5;x-=width+6;add(word,x,y+8+(x<660?15:0));});
  lines.forEach((line,i)=>{let x=460;line.split(' ').forEach(word=>{x-=word.length*5+7;add(word,x,y+10+i*17);});});
  y+=Math.max(55,lines.length*17+25);borders.push(y);
 });
 return {annotation:{pages:[{width:1000,height:y+50,blocks:[{paragraphs:[{words}]}]}]},borders};
}
const facts=r=>r.flatMap(g=>[...g.bullets,...g.details.map(d=>d.fact)]);
test('coordinate table preserves all eighteen complete clauses in source order through HTML and PDF',()=>{
 const c=engine(),f=table(),text=c.inspectionVisionTableText(f.annotation,f.borders);assert.ok(text);
 const r=c.interpretSummaryText(text),groups=c.compactAnalysisGroups(r);
 assert.deepEqual(Array.from(facts(groups)),expected);
 for(const out of [c.compactAnalysisHtml(r),JSON.stringify(c.btPdfAnalysisCards(r))]){let last=-1;for(const fact of expected){const index=out.indexOf(fact);assert.ok(index>last,fact);last=index;}}
 for(const fact of expected.slice(7,10))assert.ok(c.professionalOverallConclusion(r).highConclusion.includes(fact),fact);
 assert.ok(c.professionalOverallConclusion(r).informationConclusion.includes(expected[1]));
 assert.ok(!groups.some(g=>g.bullets.includes('הוחלפו')));
});
test('commands and component slashes remain intact; independent diagnoses on either side can separate',()=>{
 const c=engine();for(const phrase of ['בדוק/תקן מערכת קירור בלחץ','בדוק / תיקון / כוון זוויות היגוי','בדיקת תצרוכת שמן בנסיעה','בדוק תצרוכת שמן בנסיעה']){
  const r=c.interpretSummaryText('מנוע\n'+phrase);assert.ok(r.findings.length,phrase);
  assert.ok(facts(c.compactAnalysisGroups(r)).includes(phrase.replace(/\s*\/\s*/g,'/')),phrase);
 }
 assert.deepEqual(Array.from(c.reportLines('ציריות/גל הינע')),['ציריות/גל הינע']);
 assert.deepEqual(Array.from(c.reportLines('צלחות בלם שחוקות/צמיגים פגומים')),['צלחות בלם שחוקות','צמיגים פגומים']);
 assert.deepEqual(Array.from(c.reportLines('נזילות שמן/מים')),['נזילות שמן/מים']);
});
test('single fragments cannot become classified findings even below a severity heading',()=>{
 const c=engine();for(const phrase of ['הוחלפו','שחוקות','ומאחור','בדוק/תקן']){
  const r=c.interpretSummaryText('צמיגים וחישוקים\nמשמעות גבוהה\n'+phrase);assert.equal(r.findings.length,0,phrase);assert.ok(r.unknown.length);
  const legacy={findings:[{category:'צמיגים וחישוקים',sourceText:phrase,reportSeverity:'high'}]};assert.equal(c.compactAnalysisGroups(legacy).length,0);
 }
});
test('source order wins over fixed category and severity order, including alternating severities',()=>{
 const c=engine(),text='שלדת מרכב\nמשמעות נמוכה: תיקוני פח וצבע\nמשמעות גבוהה: תיקון משקופים\nמשמעות נמוכה: תיקון פח אחורי\nמנוע\nלבדוק תצרוכת שמן בנסיעה';
 assert.deepEqual(Array.from(facts(c.compactAnalysisGroups(c.interpretSummaryText(text)))),['תיקוני פח וצבע','תיקון משקופים','תיקון פח אחורי','לבדוק תצרוכת שמן בנסיעה']);
});
test('new wording and lengthy diagnoses survive without invented synonyms or clipped endings',()=>{
 const c=engine(),phrase='בדיקה של מכלול מותאם במערכת ההיגוי '+Array(45).fill('בהתאם למסמך הבדיקה').join(' ')+' עד לסיום האבחנה';
 const r=c.interpretSummaryText('מערכת ההיגוי\n'+phrase);assert.ok(facts(c.compactAnalysisGroups(r)).includes(phrase));assert.ok(JSON.stringify(c.btPdfAnalysisCards(r)).includes(phrase));
});
test('saved manager meanings and severity persist without moving clauses to the end',()=>{
 const c=engine(),row={source_kind:'observed',source_id:'sample-004',source_text:expected[1],category:'מנוע',report_severity:'none',classification_type:'recommendation',meaning:'הסבר מנהל שמור',active:true},f=table(),text=c.inspectionVisionTableText(f.annotation,f.borders);
 const r=c.applyCustomRules(text,c.applyServerOverrides(c.interpretSummaryText(text,[row]),[row]),[row]);
 assert.equal(c.compactAnalysisGroups(r)[0].category,'מנוע ומערכות נלוות');assert.ok(c.compactAnalysisGroups(r)[0].details.some(d=>d.meaning===row.meaning));
 assert.ok(JSON.stringify(c.btPdfAnalysisCards(r)).includes(row.meaning));
 const raw='מערכת ההיגוי\nזוויות היגוי (כיוון)\nמנוע\nלבדוק תצרוכת\nשמן בנסיעה';
 const rr=c.applyCustomRules(raw,c.applyServerOverrides(c.interpretSummaryText(raw,[row]),[row]),[row]);
 assert.equal(c.compactAnalysisGroups(rr)[0].category,'מערכת ההיגוי');assert.equal(c.compactAnalysisGroups(rr).at(-1).category,'מנוע ומערכות נלוות');
});
test('verifier cannot append orphan replacements as new tyre diagnoses',()=>{
 const c=engine(),primary='צמיגים וחישוקים\nצמיגים פגומים\nשלדת מרכב\nמשמעות נמוכה: הוחלפו חלקי מרכב';
 const merged=c.mergeVerifiedOcrText(primary,'צמיגים וחישוקים\nהוחלפו',true);assert.equal(merged.added,0);
});
test('browser and server share the clause parser and source-order rules',()=>{
 for(const name of ['reportClauseIsFragment','reportClauseDisplayText','reportIndependentClauses','reportLines','findingTextIncludes','orderFindingsLikeReport','interpretSummaryText']){
  const extract=s=>{const start=s.indexOf('function '+name+'(');return s.slice(start,s.indexOf('\n}\n',start)+3);};assert.equal(extract(html),extract(server),name);
 }
});
