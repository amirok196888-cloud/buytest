const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8');
function engine(){const c={Deno:{env:{get:()=>''},serve(){}},console,escapeHtml:s=>String(s)};vm.createContext(c);vm.runInContext(server.replace(/^import .*\n/,''),c);vm.runInContext(html.slice(html.indexOf('const compactSeverityRank='),html.indexOf('\nfunction unknownFindingsHtml(')),c);vm.runInContext(html.slice(html.indexOf('function btPdfAnalysisCards('),html.indexOf('\nfunction btPdfExceptionCards(')),c);vm.runInContext(html.slice(html.indexOf('function ocrComparisonLines('),html.indexOf('\nfunction cleanOcrText(')),c);return c;}
// Transcribed from the screenshots: broken OCR must not become a brake diagnosis.
const noise='שמשה קדמיתהוחלפה nywnl 20 תאורה | = פנסים קדמיים דהויים פנס איתות מראת צד שבורה סימני שיפוץ החלפת yan לבדוק מספרמנוע רעש גלגלותמנוע ולבדוק תאריךמצבר || מערכת ההיגוי נקישה בהגה משאבת הגה הרועשת סימני פגיעה בחזית';
test('noisy mixed-system row is quarantined; known facts survive in their own systems in HTML and PDF',()=>{const c=engine(),r=c.interpretSummaryText('מערכת הבלמים (ללא פירוק גלגלים)\nלפרק גלגלים לבדיקה\n'+noise),groups=c.compactAnalysisGroups(r);assert.equal(r.unreadable.length,1);const brakes=groups.filter(g=>g.category==='מערכת הבלמים');assert.ok(brakes.length);assert.ok(brakes.every(g=>g.bullets.every(s=>! /חזית|פנס|הגה|מנוע|שמשה|nywnl/.test(s))));for(const output of [c.compactAnalysisHtml(r),c.analysisTextBlock('סיכום',r),JSON.stringify(c.btPdfAnalysisCards(r))]){assert.ok(!output.includes('nywnl'));assert.ok(!output.includes('||'));assert.match(output,/לא נקרא באופן מהימן/);}assert.ok(groups.some(g=>g.category==='מערכת ההיגוי'));});
test('the observed mixed row cannot relocate an engine fact into chassis',()=>{const c=engine();const groups=c.compactAnalysisGroups({findings:[{category:'מנוע',sourceText:'נזילת שמן',observedText:'נזילת שמן תיקון מרכב',reportSeverity:'low'}]});assert.equal(groups[0].category,'מנוע ומערכות נלוות');});
test('same fact from aliases and repeated OCR passes is emitted once, with one manager explanation',()=>{const c=engine(),item={category:'מנוע',sourceText:'לחץ עוקה',reportSeverity:'high',managerEdited:true,managerMeaning:'הסבר מכני מסוים',managerDecision:'בדיקת מנוע'};const r={findings:[{...item,id:'a'},{...item,id:'b'},{...item,id:'c',sourceText:'לחץ  עוקה',reportSeverity:'low'}]};const groups=c.compactAnalysisGroups(r);assert.equal(groups.length,1);assert.equal(groups[0].details.length,1);assert.equal(groups[0].bullets.length,0);for(const output of [c.compactAnalysisHtml(r),c.analysisTextBlock('סיכום',r),JSON.stringify(c.btPdfAnalysisCards(r))])assert.equal(output.split('הסבר מכני מסוים').length-1,1);});
test('engine repair and structural accident history have different conclusions',()=>{const c=engine();for(const [category,positive,negative] of [['מנוע',/ניתנים לתיקון/,/ירידת ערך/],['שלדת מרכב',/אינו מוחק את עבר הפגיעה.*ירידת ערך/,/ליקויים מכניים במנוע/]]){const r={findings:[{category,sourceText:category==='מנוע'?'לחץ עוקה':'תיקון משקופים',reportSeverity:'high'}]},out=c.professionalOverallConclusion(r).highConclusion;assert.match(out,positive);assert.doesNotMatch(out,negative);}});
test('verifier additions retain source category and refuse gibberish',()=>{const c=engine(),merged=c.mergeVerifiedOcrText('שלדת מרכב\nתיקוני פח וצבע','מערכת ההיגוי\nנקישה בהגה\nמערכת הבלמים (ללא פירוק גלגלים)\n'+noise,true);assert.match(merged.text,/מערכת ההיגוי\nנקישה בהגה/);assert.ok(!merged.text.includes('nywnl'));const r=c.interpretSummaryText(merged.text);assert.ok(r.findings.filter(f=>/נקישה/.test(f.sourceText||f.matchedTerm||'')).every(f=>/היגוי/.test(f.category)));});
test('explicit engine severity stays in engine, not a chassis severity heading',()=>{const c=engine(),r=c.interpretSummaryText('מנוע\nמשמעות גבוהה: לחץ עוקה\nשלדת מרכב\nמשמעות נמוכה: תיקוני פח וצבע');assert.ok(r.findings.some(f=>f.category==='מנוע'&&f.reportSeverity==='high'));assert.ok(!r.findings.some(f=>/שלד/.test(f.category)&&/לחץ עוקה/.test(f.sourceText||f.matchedTerm||'')));});

test('clean foreign-system text below brakes does not become a brake finding',()=>{const c=engine(),r=c.interpretSummaryText('מערכת הבלמים (ללא פירוק גלגלים)\nפנסים קדמיים דהויים פנס איתות מראת צד שבורה');const groups=c.compactAnalysisGroups(r);assert.ok(!groups.some(g=>g.category==='מערכת הבלמים'));assert.ok(groups.some(g=>g.category==='חשמל ואבזור'));});


test('engine number instruction remains visible and requires authorized garage even without repair evidence',()=>{
 const c=engine();const r=c.interpretSummaryText('מנוע\nלבדוק מספר מנוע במוסך מורשה');
 const item=r.findings.find(f=>f.requiresEngineNumberVerification);assert.ok(item);assert.equal(item.reportSeverity,null);
 const followup=c.engineNumberFollowUpText(r);assert.match(followup,/יש לאתר ולקרוא את מספר המנוע/);assert.match(followup,/לאמת את התאמתו לרישיון/);assert.match(followup,/אינה מוכיחה לבדה שהמנוע הוחלף/);
 for(const output of [c.compactAnalysisHtml(r),c.analysisTextBlock('סיכום',r),JSON.stringify(c.btPdfAnalysisCards(r))]){assert.match(output,/מספר מנוע — נדרש בירור במוסך מורשה/);assert.match(output,/יש להשלים את הבירור גם אם לא נרשמו סימני פירוק או שיפוץ/);}
 assert.equal(c.professionalOverallConclusion(r).highConclusion,'');
});
test('number instruction alongside either engine removal or overhaul gets a combined customer warning',()=>{
 const c=engine();for(const history of ['סימני פתיחת ברגים בין המנוע לגיר','סימני שיפוץ מנוע']){
 const r=c.interpretSummaryText('מנוע\nלבדוק מספר מנוע במוסך מורשה\n'+history);
 assert.ok(r.findings.some(f=>(f.sourceText||f.matchedTerm||'').includes(history)));
 for(const output of [c.compactAnalysisHtml(r),c.analysisTextBlock('סיכום',r),JSON.stringify(c.btPdfAnalysisCards(r))]){assert.match(output,/לברר במוסך מה בוצע/);assert.match(output,/תיעוד תיקון או החלפה/);}
 }
});
test('unreadable engine number is a follow-up instruction, whereas an actual identity field stays metadata',()=>{
 const c=engine();for(const instruction of ['מספר מנוע לא נראה לבדוק במוסך מורשה','מספר מנוע לא קריא','לא ניתן לראות את מספר המנוע','בדוק את מספר המנוע במוסך מורשה']){
 assert.equal(c.isMetadataLine(instruction),false);const r=c.interpretSummaryText('מנוע\n'+instruction);assert.match(c.engineNumberFollowUpText(r),/נדרשת בדיקה במוסך מורשה/);
 }
 for(const metadata of ['מספר מנוע: 123456','מספר מנוע: ABC123']){
 assert.equal(c.isMetadataLine(metadata),true);assert.equal(c.engineNumberFollowUpText(c.interpretSummaryText(metadata)),'');
 }
});
test('number mismatch retains its own significance rather than being described as a visibility problem',()=>{
 const c=engine(),r=c.interpretSummaryText('מנוע\nמספר מנוע לא תואם לרישיון הרכב');assert.ok(r.findings.length);assert.equal(c.engineNumberFollowUpText(r),'');
 assert.ok(r.findings.some(f=>f.reportSeverity==='high'));
});
