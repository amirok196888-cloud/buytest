const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function mileage(source){const c={loadedKm:134695,externalVehicleData:{kmHistory:[]}};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function reportMileageReadings('),source.indexOf('\nfunction applyEngineWarrantyContext')),c);return c;}
for(const file of ['index.html','supabase/functions/buytest-analyze/index.ts']){
 const c=mileage(fs.readFileSync(file,'utf8'));
 test(file+' searches every report position and reads the actual 80477001 header',()=>{
  const header='מס׳ רכב: 80477001 תוצר: טויוטה דגם: קורולה שנת יצור: 2019 מס׳ מנוע: 3108 ק״מ: 102304 או מייל';
  for(const text of [header, 'ממצאי בדיקה\n'+header, 'ממצאים\n'+header+'\nסוף הדוח'])assert.equal(c.reportKmForEngineWarranty(text,false),102304);
  for(const text of ['קילומטראז׳: 102,304','102 304 ק״מ','מד אוץ: 102304','Mileage: 102304','ק״מ או מייל 102304'])assert.equal(c.reportKmForEngineWarranty(text,false),102304,text);
 });
 test(file+' never substitutes registry mileage or guesses from unrelated numbers',()=>{
  for(const text of ['מספר רכב 80477001 שנת יצור 2019 מספר מנוע 3108','קמ: 80477001','קמ: 3000000'])assert.equal(c.reportKmForEngineWarranty(text,false),0,text);
  assert.equal(c.reportKmForEngineWarranty('קמ: 102304\nקמ: 134695',false),0);
 });
}
function alerts(dossier){const c={btDossier:()=>dossier,btInsuranceCrossSourceAlerts:()=>[],fmtNum:n=>Number(n).toLocaleString('en-US'),Date};vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function btMileage('),html.indexOf('\nfunction btSourceLines(')),c);vm.runInContext(html.slice(html.indexOf('function btSummaryAlerts('),html.indexOf('\nfunction btUnifiedEntries(')),c);return c.btSummaryAlerts();}
test('actual discrepancy is explicit, without asserting chronological rollback when date is missing',()=>{
 const list=alerts({sources:{registry:{mileage:[{km:134695,date:'',source:'מאגר הרישוי'}]},inspection:{mileage:[{km:102304,date:'',source:'דוח המכון'}]}}});assert.equal(list.length,1);assert.match(list[0],/32,391/);assert.match(list[0],/נדרש בירור/);assert.doesNotMatch(list[0],/ירידה בקילומטראז׳ בין/);
 assert.ok(html.includes('const entries=btUnifiedEntries();reportText=entries.map'));
 assert.ok(html.includes('btSummaryAlerts().includes(line)'));
});
test('dated normal increase does not produce discrepancy',()=>assert.equal(alerts({sources:{a:{mileage:[{km:102304,date:'2025-01-01',source:'דוח המכון'}]},b:{mileage:[{km:134695,date:'2026-10-09',source:'מאגר הרישוי'}]}}}).length,0));
