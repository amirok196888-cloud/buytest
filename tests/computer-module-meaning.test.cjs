const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8');
function engine(browser=false){const c={Deno:{env:{get:()=>''},serve(){}},console,escapeHtml:String};vm.createContext(c);vm.runInContext(server.replace(/^import .*\n/,''),c);
 if(browser){vm.runInContext(html.slice(html.indexOf('function extractDtcCodeDetails('),html.indexOf('\nfunction extractComputerVehicleIdentity(')),c);vm.runInContext(html.slice(html.indexOf('function interpretComputerText('),html.indexOf('\nfunction computerFindingsHtml(')),c);}
 vm.runInContext(html.slice(html.indexOf('const compactSeverityRank='),html.indexOf('\nfunction unknownFindingsHtml(')),c);vm.runInContext(html.slice(html.indexOf('function btPdfAnalysisCards('),html.indexOf('\nfunction btPdfExceptionCards(')),c);return c;}
// Exact text and section order visible in the user's Hyundai diagnostic screenshot.
const report=`Diagnostic Trouble Code
HYUNDAI V51.91 Elantra(AD) 2018 12.01V
Airbag(Event #1)
B250000 Warning lamp Failure History
B110200 Battery Voltage Low History
Airbag(Event #2)
B250000 Warning lamp Failure History
B110200 Battery Voltage Low History
ECM (Engine Control Module) Normal
TCM (Transmission Control Module) Normal
ABS (Anti-lock Braking System) Normal
AC (Air Conditioning) Normal
Body Control Module Normal
Cluster Module Normal
Smart Junction Block Normal
TPMS (Tire Pressure Monitoring System) Normal`;
for(const browser of [false,true])test(`${browser?'browser':'server'} retains airbag headings, translates descriptions and deduplicates event repeats in HTML and PDF`,()=>{
 const c=engine(browser),r=c.interpretComputerText(report);assert.equal(r.codes.length,2);assert.equal(r.findings.length,2);
 for(const f of r.findings){assert.equal(f.category,'מערכת כריות האוויר');assert.equal(f.dtcStatusKey,'historical');assert.equal(f.dtcSeverity,'safety');assert.ok(f.title);}
 const groups=c.compactAnalysisGroups(r,true);assert.equal(groups.length,1);assert.equal(groups[0].bullets.length,2);assert.match(groups[0].bullets.join(' '),/נורת האזהרה של כריות האוויר/);assert.match(groups[0].bullets.join(' '),/מתח מצבר נמוך/);assert.match(groups[0].decision,/לברר במוסך/);assert.doesNotMatch(groups[0].decision,/לידיעה בלבד/);
 const pdf=JSON.stringify(c.btPdfAnalysisCards(r,true));assert.match(pdf,/מערכת כריות האוויר/);assert.match(pdf,/נורת האזהרה/);assert.match(pdf,/מתח מצבר נמוך/);assert.match(pdf,/היסטוריות/);assert.match(c.compactAnalysisHtml(r,true),/נורת האזהרה/);
 const finalPdf=JSON.stringify(c.btPdfProfessionalCards({findings:[],unknown:[]},r));assert.match(finalPdf,/נורת האזהרה/);assert.match(finalPdf,/מתח מצבר נמוך/);assert.match(finalPdf,/לברר במוסך/);
});
test('separate-line descriptions and history still retain the nearest module',()=>{const c=engine();const r=c.interpretComputerText('Airbag(Event #1)\nB250000\nWarning lamp Failure\nHistory\nB110200\nBattery Voltage Low\nHistory\nECM (Engine Control Module) Normal');assert.equal(r.findings.length,2);assert.ok(r.findings.every(f=>f.dtcStatusKey==='historical'&&f.category==='מערכת כריות האוויר'));assert.match(r.findings[0].title,/נורת/);});
test('same code in different modules or different states is not silently discarded',()=>{const c=engine();const r=c.interpretComputerText('Airbag\nB110200 Battery Voltage Low History\nBody Control Module\nB110200 Battery Voltage Low Current');assert.equal(r.findings.length,2);assert.ok(r.findings.some(f=>f.dtcStatusKey==='active'&&f.category==='חשמל ואבזור'));assert.ok(r.findings.some(f=>f.dtcStatusKey==='historical'&&f.category==='מערכת כריות האוויר'));});
test('generic word CODEA is not a fault code and Normal sections do not invent failures',()=>{const c=engine();assert.equal(c.extractDtcCodes('CODEA Code ABCDE').length,0);assert.equal(c.interpretComputerText('Airbag Normal\nECM (Engine Control Module) Normal').findings.length,0);});
