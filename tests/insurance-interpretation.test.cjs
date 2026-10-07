const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../insurance-interpretation.js'),'utf8'),context);
const interpret=context.BuyTestInsurance.interpret;

test('vehicle plate may appear before the RTL license label; inquiry date is kept separate',()=>{
 const result=interpret('29-09-2026 תאריך השאילתה\n30281601 מס׳ רישוי\nטבלה ב - פרטי התביעות');
 assert.equal(result.plate,'30281601');assert.equal(result.queryDate,'29-09-2026');assert.equal(result.claims.length,0);
});

test('same-date insured and third-party claims are shown as separate claims under one event',()=>{
 const raw=[
  'טבלה ב - פרטי התביעות',
  '24/07/2020 2214767326 בגין נזק לרכב המבוטח אובדן גמור להלכה 109101 210750402090188 סגורה הפניקס',
  '22/07/2020 2214765902 בגין נזק לרכב המבוטח נזק חלקי פתוחה הפניקס',
  '14/11/2019 190279820188 בגין נזק לרכב המבוטח נזק חלקי 43798.32 688 סגורה הראל',
  '25/11/2019 190300000371 תביעת ניזוק צד ג׳ נזק חלקי 15674 סגורה הראל',
  '25/11/2019 190300000371 תביעת ניזוק צד ג׳ נזק חלקי פתוחה הראל',
  '25/11/2019 190442739116 בגין נזק לרכב המבוטח נזק חלקי סגורה מנורה'
 ].join('\n');
 const r=interpret(raw);
 assert.equal(r.events.length,4);
 const sameDay=r.events.find(e=>e.date==='25/11/2019');
 assert.equal(sameDay.claims.length,2);
 assert.deepEqual(Array.from(sameDay.claims.map(c=>c.party)).sort(),['תביעת צד ג׳','נזק לרכב המבוטח'].sort());
 assert.match(sameDay.claims.find(c=>c.party==='תביעת צד ג׳').status,/סגורה/);
 assert.match(sameDay.claims.find(c=>c.party==='תביעת צד ג׳').status,/פתוחה/);
 assert.equal(r.summary.totalLossClaims,1);
 assert.equal(r.claims.find(c=>c.claimNumber==='2214767326').policyNumber,'210750402090188');
 assert.equal(r.summary.thirdPartyClaims,1);
 assert.equal(r.summary.sourceRecordCount,6);
 assert.match(r.text,/אין לחבר תשלומים של צד ג׳/);
});

test('right-to-left OCR text keeps vehicle plate, event date, claim, amount, and depreciation readable',()=>{
 const raw=['המגודל יחוטיב רבע חוד','30281601 יושיר ׳סמ','תועיבתה יטרפ - ב הלבט','הכלהב רומג ןדבוא בכרל קזנ ןיגב 2214767326 24/07/2020 109101 הרוגס סקינפ'].join('\n');
 const r=interpret(raw);
 assert.equal(r.plate,'30281601');
 assert.equal(r.claims[0]?.claimNumber,'2214767326');
 assert.equal(r.claims[0]?.date,'24/07/2020');
 assert.equal(r.claims[0]?.party,'נזק לרכב המבוטח');
 assert.match(r.claims[0]?.damage||'',/אובדן/);
});

test('coverage rows do not become claims and no-claims wording is qualified',()=>{
 const coverage='טבלה א — פרטי הכיסוי הביטוחי\nמספר רישוי 30281601\nסכום ביטוח 143275\nביטוח מקיף\nפניקס\n25215111926\n01/06/2026';
 const r=interpret(coverage);
 assert.equal(r.claims.length,0);assert.equal(r.status,'incomplete');
 const clean=interpret('לא נמצאו תביעות בתקופה שנבדקה');
 assert.equal(clean.status,'explicit-clean');assert.match(clean.text,/היעדר רישום אינו שולל נזק/);
});

test('claim row without a readable amount does not invent one',()=>{
 const r=interpret('טבלה ב פרטי תביעות\n25/11/2019 190300000371 תביעת ניזוק צד ג׳ נזק חלקי פתוחה');
 assert.equal(r.claims.length,1);assert.equal(r.claims[0].amounts.length,0);
});



test('theft and depreciation markers are retained as findings',()=>{
 const r=interpret(['טבלה ב — פרטי התביעות','25/11/2019 190300000371 בגין נזק לרכב המבוטח גניבה שיעור ירידת ערך 8% 12000 סגורה הראל'].join('\n'));
 assert.equal(r.claims.length,1);
 assert.equal(r.claims[0].theft,true);
 assert.equal(r.claims[0].depreciationRate,'8%');
 assert.equal(r.summary.theftClaims,1);
 assert.equal(r.summary.depreciationClaims,1);
});
