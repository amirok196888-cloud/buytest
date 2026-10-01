const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../insurance-interpretation.js'),'utf8'),context);
const interpret=context.BuyTestInsurance.interpret;
test('coverage table never becomes accident evidence or a clean claims report',()=>{
 const raw='טבלה א — פרטי הכיסוי הביטוחי\nסכום ביטוח\n143275\nביטוח מקיף\nפניקס\n25215111926\n01/06/2026\nירידת ערך\nאובדן גמור';
 const result=interpret(raw);assert.equal(result.status,'incomplete');assert.equal(result.events.length,0);assert.doesNotMatch(result.text,/143275|פניקס|25215111926|01\/06\/2026/);assert.match(result.text,/אין להסיק שהעבר הביטוחי נקי/);
});
test('claim payout and depreciation are explained without inventing chassis damage',()=>{
 const result=interpret('טבלה ב — פירוט תביעות\nתביעה בגין תאונה ב־19/02/2024. סכום תביעה: 45,000 ₪. ירידת ערך: 3%. נזק לדלת.');
 assert.equal(result.status,'findings');assert.equal(result.events[0].amount,45000);assert.equal(result.events[0].depreciation,3);assert.match(result.text,/השפעה מסחרית/);assert.match(result.text,/אין להסיק ממנה לבדה שהשלדה נפגעה/);
});
test('an explicitly negative total loss must never trigger an allegation',()=>{
 for(const text of ['אובדן גמור: לא','לא הוגדר אובדן להלכה','אובדן גמור','סוג נזק: ללא נזק'])assert.equal(interpret(text).alerts.length,0);
 const positive=interpret('הוגדר אובדן להלכה');assert.equal(positive.events[0].totalLoss,true);assert.equal(positive.alerts.length,1);
});
test('explicit no-claims statement is qualified and third-party claims are distinguished',()=>{
 assert.equal(interpret('לא נמצאו תביעות בתקופה שנבדקה').status,'explicit-clean');assert.match(interpret('לא נמצאו תביעות').text,/תיקון פרטי/);
 const third=interpret('תביעה לצד ג׳. סכום תביעה: 12000 ₪');assert.equal(third.events[0].thirdParty,true);assert.match(third.text,/אין להסיק ממנה לבדה מה היקף הנזק לרכב הנבדק/);
});
