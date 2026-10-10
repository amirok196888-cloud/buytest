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

test('the secondary OCR pass cannot reintroduce joined-word duplicates or partial lamp fragments',()=>{
 const c=engine(),f=table(),primary=c.inspectionVisionTableText(f.annotation,f.borders);
 const secondary='מערכות הנעה\nצלחותבלם\nתיבת העברת הכוח\nצלחותבלם שחוקות\nצמיגים וחישוקים\nאווירדולקת\nצמיגים וחישוקים\nמשמעות גבוהה\nפגיעה בעמוד אמצעי צדשמאל\nשלדת מרכב\nמשמעות נמוכה\nתיקוני פחחות וצבע עםמילוי חומר\nשלדת מרכב\nמשמעות נמוכה\nתיקון פחאחורי';
 const merged=c.mergeVerifiedOcrText(primary,secondary,true);assert.equal(merged.added,0);
 const r=c.interpretSummaryText(merged.text);assert.deepEqual(Array.from(facts(c.compactAnalysisGroups(r))),expected);
 for(const output of [c.compactAnalysisHtml(r),JSON.stringify(c.btPdfAnalysisCards(r))])assert.ok(!output.includes('אווירדולקת'));
 const legacy={findings:[{category:'צמיגים וחישוקים',sourceText:'אווירדולקת',classification:'source_diagnosis'}]};assert.equal(c.compactAnalysisGroups(legacy).length,0);
});
test('saved explanations interleaved with plain findings preserve all eighteen source clauses in HTML and PDF',()=>{
 const c=engine(),f=table(),text=c.inspectionVisionTableText(f.annotation,f.borders);
 const rows=[
  ['sample-004','מנוע',expected[1],'הסבר שמור לשמן'],
  ['sample-024','מנוע',expected[0],'הסבר שמור לטיפולים'],
  ['sample-029','צמיגים וחישוקים','נורת לחץ אוויר דולקת','הסבר שמור לחיישן'],
  ['sample-017','שלדת מרכב',expected[12],'הסבר שמור לחלקים']
 ].map(([source_id,category,source_text,meaning])=>({source_kind:'observed',source_id,category,source_text,meaning,report_severity:category==='שלדת מרכב'?'low':'none',classification_type:'recommendation',active:true}));
 const r=c.applyCustomRules(text,c.applyServerOverrides(c.interpretSummaryText(text,rows),rows),rows);
 for(const output of [c.compactAnalysisHtml(r),JSON.stringify(c.btPdfAnalysisCards(r))]){
  let last=-1;for(const fact of expected){const index=output.indexOf(fact);assert.ok(index>last,fact);last=index;}
  for(const row of rows)assert.ok(output.includes(row.meaning));
 }
 assert.deepEqual(Array.from(c.compactAnalysisGroups(r).flatMap(g=>c.compactGroupFacts(g))),expected);
});

test('orphan OCR fragments remain diagnostic audit data and never appear as conclusions',()=>{
 const c=engine(),r=c.interpretSummaryText('צמיגים וחישוקים\nאווירדולקת\nשחוקות');assert.ok(r.unknown.length);
 const conclusion=c.professionalOverallConclusion(r).reviewConclusion;assert.ok(!conclusion.includes('אווירדולקת'));assert.ok(!conclusion.includes('שחוקות'));
 assert.ok(!JSON.stringify(c.btPdfAnalysisCards(r)).includes('אווירדולקת'));
});

test('sheet metal and paint defects cannot inherit electrical category or severity',()=>{
 const c=engine(),phrase='פגיעות פח ופגמים בצבע ובגג';
 const r=c.interpretSummaryText('חשמל ואבזור\nמשמעות גבוהה\n'+phrase);
 assert.ok(r.findings.length);assert.ok(r.findings.every(f=>f.category==='שלדת מרכב'));
 assert.ok(r.findings.every(f=>f.reportSeverity!=='high'));
 const legacy={findings:[{category:'חשמל ואבזור',sourceText:phrase}]};
 for(const result of [r,legacy]){
  const g=c.compactAnalysisGroups(result);assert.equal(g[0].category,'שלדה ומרכב');
  for(const out of [c.compactAnalysisHtml(result),JSON.stringify(c.btPdfAnalysisCards(result))]){assert.ok(out.includes(phrase));assert.ok(!out.includes('חשמל ואבזור'));}
 }
 assert.equal(c.reportComponentCategory('מנוע חלון לא עובד'),'חשמל ואבזור');
});

test('all explicit defects in notes occupy one final card across severities and systems',()=>{
 const c=engine(),heading='ליקויים שנרשמו בהערות שצריך לתת עליהן את הדעת';
 const notes=['פגיעות פח ופגמים בצבע ובגג','צלחות בלם שחוקות','מנורת לחץ אוויר דולקת','מזגן לא מקרר'];
 const text='מנוע\nלבדוק תצרוכת שמן בנסיעה\nחשמל ואבזור\nמנוע חלון לא עובד\nהערות כלליות:\nמשמעות גבוהה: '+notes[0]+', '+notes[1]+'\nמשמעות נמוכה: '+notes[2]+', '+notes[3]+'.\nאין אחריות על תיבת הילוכים אוטומטית. לא נבדקה מערכת היברידית. מצורף דוח מחשב. לבדוק מעקב טיפולים. יש לברר זמני טיפולים.';
 const row={source_kind:'custom',source_id:'notes-only',source_text:notes[1],category:'מערכת הבלמים (ללא פירוק גלגלים)',meaning:'הסבר שמור',active:true};
 const r=c.applyCustomRules(text,c.applyServerOverrides(c.interpretSummaryText(text,[row]),[row]),[row]);
 assert.deepEqual(Array.from(r.noteFindings.map(f=>f.sourceText)),notes);
 assert.ok(r.findings.every(f=>!notes.includes(f.sourceText)));
 const groups=c.compactAnalysisGroups(r),noteGroups=groups.filter(g=>g.sourceSection==='notes');
 assert.equal(noteGroups.length,1);assert.equal(groups.at(-1).category,heading);
 assert.deepEqual(Array.from(c.compactGroupFacts(noteGroups[0])),notes);
 for(const out of [c.compactAnalysisHtml(r),c.analysisTextBlock('סיכום',r),JSON.stringify(c.btPdfAnalysisCards(r))]){
  assert.equal(out.split(heading).length-1,1);for(const fact of notes)assert.equal(out.split(fact).length-1,1,fact);
  assert.ok(!out.includes('אין אחריות'));assert.ok(!out.includes('לא נבדקה מערכת היברידית'));
 }
});

test('short examiner notes and wrapped defects survive without manufacturing normal findings',()=>{
 const c=engine();
 for(const marker of ['הערות','הערות הבוחן:','הערת בוחן:']){
  const r=c.interpretSummaryText('מנוע\nתקין\n'+marker+'\nצלחות בלם\nשחוקות, מנורת לחץ אוויר דולקת. אין נזילות שמן. הצמיגים תקינים.');
  assert.equal(r.findings.length,0);
  assert.deepEqual(Array.from(r.noteFindings.map(f=>f.sourceText)),['צלחות בלם שחוקות','מנורת לחץ אוויר דולקת']);
  assert.equal(c.compactAnalysisGroups(r).length,1);
 }
 assert.equal(c.compactAnalysisGroups(c.interpretSummaryText('מנוע\nתקין\nהערות כלליות\nאין אחריות על תיבת הילוכים אוטומטית')).length,0);
});

test('secondary OCR additions remain in table before the single notes section',()=>{
 const c=engine(),primary='מנוע\nלבדוק מעקב טיפולים\nהערות כלליות\nפגיעות פח ופגמים בצבע ובגג';
 const secondary='מנוע\nלבדוק תצרוכת שמן בנסיעה\nהערות כלליות\nפגיעות פח ופגמים בצבע ובגג';
 const merged=c.mergeVerifiedOcrText(primary,secondary,true),r=c.interpretSummaryText(merged.text);
 assert.ok(r.findings.some(f=>f.sourceText==='לבדוק תצרוכת שמן בנסיעה'));
 assert.deepEqual(Array.from(r.noteFindings.map(f=>f.sourceText)),['פגיעות פח ופגמים בצבע ובגג']);
});

test('coordinate OCR retains the notes row without mixing it into the last system',()=>{
 const c=engine(),f=table(),y=f.borders.at(-1),words=f.annotation.pages[0].blocks[0].paragraphs[0].words;
 const add=(text,x,y,width)=>words.push({symbols:Array.from(text,text=>({text})),boundingBox:{vertices:[{x,y},{x:x+width,y},{x:x+width,y:y+10},{x,y:y+10}]}});
 add('הערות',810,y+10,45);add('כלליות',755,y+10,45);
 add('פגיעות פח ופגמים בצבע ובגג,',70,y+10,350);add('צלחות בלם שחוקות',70,y+30,300);
 f.borders.push(y+65);f.annotation.pages[0].height=y+100;
 const text=c.inspectionVisionTableText(f.annotation,f.borders),r=c.interpretSummaryText(text);
 assert.deepEqual(Array.from(facts(c.compactAnalysisGroups({findings:r.findings}))),expected);
 assert.deepEqual(Array.from(r.noteFindings.map(f=>f.sourceText)),['פגיעות פח ופגמים בצבע ובגג','צלחות בלם שחוקות']);
});

test('notes and component classification stay identical in browser and server',()=>{
 for(const name of ['reportTextSections','reportNotesFindings','reportComponentCategory']){
  const extract=s=>{const start=s.indexOf('function '+name+'(');return s.slice(start,s.indexOf('\n}\n',start)+3);};assert.equal(extract(html),extract(server),name);
 }
});
