const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function engine(){const c={Deno:{env:{get:()=>''},serve(){}},console,escapeHtml:String};vm.createContext(c);vm.runInContext(fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8').replace(/^import .*\n/,''),c);vm.runInContext(html.slice(html.indexOf('const compactSeverityRank='),html.indexOf('\nfunction compactAnalysisHtml(')),c);return c;}
test('specific component overrides a stale heading without inheriting its high severity',()=>{
 const c=engine();for(const [phrase,label] of [
 ['חסר מים מיכל עיבוי לבדוק את מערכת הקירור בלחץ','מערכת הקירור'],
 ['נקישות במתלים','מערכת המתלים'],['משאבת הגה פגומה','מערכת ההיגוי'],
 ['רפידות שחוקות','מערכת הבלמים'],['מזגן אוויר אינו פועל','מיזוג אוויר'],
 ['קורוזיה בטרמוסטט','מערכת הקירור'],['נזילת שמן בתיבת הילוכים','תיבת הילוכים והעברת כוח'],
 ['צמיגים קדמיים פגומים','צמיגים וגלגלים'],['מערכת מולטימדיה פגומה','חשמל ואבזור'],
 ['מנוע שורף שמן','מנוע ומערכות נלוות']]){
  const heading=label==='תיבת הילוכים והעברת כוח'?'מערכת הקירור':'תיבת הילוכים';
  const r=c.interpretSummaryText(heading+'\nמשמעות גבוהה\n'+phrase);
  assert.ok(r.findings.length,phrase);assert.ok(c.compactAnalysisGroups(r).every(g=>g.category===label),phrase+': '+JSON.stringify(c.compactAnalysisGroups(r).map(g=>g.category)));
  assert.ok(r.findings.every(f=>!f.explicitReportSeverity),phrase);
 }
});
test('parts with similar words retain the actual component category',()=>{
 const c=engine();for(const [phrase,category] of [['מכסה מנוע פגום','שלדת מרכב'],['כנף פנימית אחורית נושאת בולם זעזועים','שלדת מרכב'],['מנוע חלון פגום','חשמל ואבזור'],['לתקן אור בלם','מערכת תאורה'],['מצמד מאוורר פגום','מערכת הקירור'],['קולר גיר פגום','תיבת הילוכים'],['נוזל קירור בשמן','מנוע'],['נזילת שמן בין בלוק מנוע לתיבת הילוכים','מנוע']])assert.equal(c.reportFindingCategory(phrase,'מערכת ההיגוי'),category,phrase);
});
test('ambiguous generic catalog phrases do not become facts in an unrelated system',()=>{
 const c=engine();assert.equal(c.reportFindingCategory('בלאי סביר','מערכת הקירור'),'ממצאים נוספים');
 assert.equal(c.reportFindingCategory('רעידות יתר','מערכת הקירור'),'ממצאים נוספים');
 assert.ok(c.findKnowledgeRules('רעידות יתר','מערכת הקירור').every(f=>c.reportSystemFamily(f.category)==='cooling'));
});
test('all 636 catalog records have category identifiers matching their audited category',()=>{
 const c=engine();vm.runInContext('globalThis.catalog=rawFormulaDatabase;globalThis.aliases=observedFormulaAliases;globalThis.definitions=formulaCategoryDefinitions',c);
 assert.equal(c.catalog.length,598);assert.equal(c.aliases.length,38);
 for(const r of c.catalog){const d=c.definitions.find(d=>d.name===r.category);assert.ok(d||r.category==='ממצאים נוספים',r.id);if(d)assert.equal(r.category_id,d.id,r.id);}
 for(const d of c.definitions)assert.equal(d.formula_count,c.catalog.filter(r=>r.category===d.name).length,d.name);
});
test('central deletion preserves an identical diagnosis with a different identity',()=>{
 const c=engine();const deleted={source_kind:'formula',source_id:'technotest-583',source_text:'נורת לחץ אוויר דולקת',category:'צמיגים וחישוקים',active:false};
 const result=c.applyCustomRules('צמיגים וחישוקים\nנורת לחץ אוויר דולקת\nצמיגים קדמיים פגומים',c.applyServerOverrides(c.interpretSummaryText('צמיגים וחישוקים\nנורת לחץ אוויר דולקת\nצמיגים קדמיים פגומים',[deleted]),[deleted]),[deleted]);
 assert.ok(!result.findings.some(f=>f.id==='formula-technotest-583'));assert.ok(result.findings.some(f=>/נורת לחץ אוויר/.test(f.sourceText||'')));assert.ok(result.findings.some(f=>/צמיגים קדמיים/.test(f.sourceText||'')));
 assert.equal(c.normalizedOverride({...deleted,source_text:'נורת לחץ אוויר דולקת',report_severity:'none'}).active,false);
});
test('every catalog phrase parses without leaking a nested component into a different system',()=>{
 const c=engine();vm.runInContext('globalThis.catalog=[...rawFormulaDatabase,...observedFormulaAliases].filter(isOperationalFormula)',c);
 for(const row of c.catalog){const result=c.interpretSummaryText(row.category+'\n'+row.text);for(const f of result.findings)assert.equal(c.reportSystemFamily(f.category),c.reportSystemFamily(row.category),row.id+' '+row.text+' -> '+f.sourceText);}
});
