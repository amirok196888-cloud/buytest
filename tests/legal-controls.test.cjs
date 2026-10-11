const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('legal-controls.js','utf8');
function setup({stored=null,blocked=false,checked=false,service='report'}={}){
 const values=new Map(stored===null?[]:[['buytestMarketingConsentV1',stored]]);let alerts=0;
 const input={checked,focus(){},scrollIntoView(){}};
 const c={localStorage:{getItem:k=>values.get(k)||null},document:{body:{dataset:{service}},getElementById:()=>input,addEventListener(){}},BuyTestInternalTraffic:{blocked:()=>blocked},alert(){alerts++}};
 vm.runInNewContext(source,c);return {c,alerts:()=>alerts};
}
test('advertising is off by default and remains off if consent storage is unavailable',()=>{assert.equal(setup().c.BuyTestLegal.canTrack(),false);const {c}=setup({stored:'yes'});c.localStorage.getItem=()=>{throw Error()};assert.equal(c.BuyTestLegal.canTrack(),false)});
test('only explicit consent enables advertising and internal visits stay excluded',()=>{for(const stored of [null,'no','true'])assert.equal(setup({stored}).c.BuyTestLegal.canTrack(),false);assert.equal(setup({stored:'yes'}).c.BuyTestLegal.canTrack(),true);assert.equal(setup({stored:'yes',blocked:true}).c.BuyTestLegal.canTrack(),false)});
test('upload permission requires a visible affirmative checkbox',()=>{const denied=setup();assert.equal(denied.c.BuyTestLegal.requireUpload('inspectionOwnership'),false);assert.equal(denied.alerts(),1);assert.equal(setup({checked:true}).c.BuyTestLegal.requireUpload('inspectionOwnership'),true)});
test('all entry pages gate marketing and remove the prechecked upload approval',()=>{for(const filename of ['index.html','facebook-20260928.html','facebook-final-20260928.html']){const html=fs.readFileSync(filename,'utf8');assert.match(html,/if\(window.BuyTestLegal.canTrack\(\)\)/);assert.doesNotMatch(html,/<script[^>]+src="https:\/\/www.googletagmanager.com/);assert.match(html,/<input type="checkbox" id="inspectionOwnership">/);assert.match(html,/requireUpload\('inspectionOwnership'\)/);assert.match(html,/השימוש באתר באחריותו של המשתמש בלבד/);assert.doesNotMatch(html,/שירות משולב בתשלום לרכב אחד/);assert.match(html,/ללא חידוש אוטומטי/);}});
test('license and insurance uploads check approval before OCR',()=>{for(const [filename,id] of [['opening-20260928.js','licenseLegalAccept'],['external-insurance.js','insuranceLegalAccept']]){const s=fs.readFileSync(filename,'utf8');assert.ok(s.indexOf("requireUpload('"+id+"')")<s.indexOf('googleVisionRecognize('));}});
