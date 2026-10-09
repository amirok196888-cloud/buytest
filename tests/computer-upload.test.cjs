const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),server=fs.readFileSync('supabase/functions/buytest-analyze/index.ts','utf8');
function engine(){
 const fields={vPlate:'80477001',vVin:'',vMaker:'Toyota',vModel:'Corolla',vYear:'2019'};
 const c={Deno:{env:{get:()=>''},serve(){}},console,document:{getElementById:id=>({textContent:fields[id]||''})},plate:()=>fields.vPlate};vm.createContext(c);
 vm.runInContext(server.replace(/^import .*\n/,''),c);
 // Exercise the browser's functions, not the server's separate implementation.
 vm.runInContext(html.slice(html.indexOf('function extractComputerVehicleIdentity('),html.indexOf('\nfunction computerIdentityHtml(')),c);
 vm.runInContext(html.slice(html.indexOf('function interpretComputerText('),html.indexOf('\nfunction computerFindingsHtml(')),c);
 vm.runInContext(html.slice(html.indexOf('function computerOcrTextUsable('),html.indexOf('\nfunction createDocumentReadProgress(')),c);
 return c;
}
test('uploaded computer report reaches reading-quality check and interpretation without a runtime error',()=>{
 const c=engine(),text='Vehicle diagnostic report\nLicense plate: 80477001\nEngine\nP0300 Current\nRandom multiple cylinder misfire detected';
 assert.equal(c.computerReadQuality(text).ok,true);
 const result=c.interpretComputerText(text);assert.ok(result.codes.includes('P0300'));assert.ok(result.findings.length>0);
});
test('computer report identity matches or blocks a different vehicle correctly',()=>{
 const c=engine();assert.equal(c.assessComputerVehicleIdentity({plate:'80477001'}).status,'match');assert.equal(c.assessComputerVehicleIdentity({plate:'12345678'}).status,'mismatch');assert.equal(c.assessComputerVehicleIdentity({}).status,'unverified');
});
test('readable no-fault report is accepted without inventing trouble codes',()=>{
 const c=engine(),text='Vehicle diagnostic report\nEngine control module\nNo fault codes detected';assert.equal(c.computerReadQuality(text).ok,true);assert.equal(c.interpretComputerText(text).codes.length,0);
});
