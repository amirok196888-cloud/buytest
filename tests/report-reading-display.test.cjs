const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('overall progress stays monotonic across every page and all three audits',async()=>{
 const values=[];const state={set textContent(value){values.push(Number(value.match(/(\d+)%/)[1]));}};
 const c={cleanOcrText:String,diagnosticTableText:String};vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function createDocumentReadProgress('),html.indexOf('\nfunction ocrComparisonLines(')),c);
 const progress=c.createDocumentReadProgress(state);let pass='3',index=0,count=2,jobs=0;
 progress(1);progress(15);progress(45);
 const worker={async setParameters(){},async recognize(){jobs++;for(const p of [0,.5,1])progress(45+50*((['3','6','11'].indexOf(pass)*count+index+p)/(3*count)));return {data:{text:'מנוע חוסר שמן'}};}};
 await c.recognizeDocumentSources(worker,['page1','page2'],state,(p,i,n)=>{pass=p;index=i;count=n;},()=>({score:1}),progress);
 progress(10);progress(100);assert.equal(jobs,6);assert.ok(values.every((n,i)=>i===0||n>=values[i-1]));assert.equal(values.at(-1),99);assert.ok(!values.includes(100));
 assert.match(html,/state.innerHTML='100% · '\+ocrSuccessHtml/);
});
test('reading limitations appear as a neutral footer, while actual findings keep their severity',()=>{
 assert.ok(!html.includes('חלק מהטקסט בדוח לא נקרא באופן מהימן.'));
 assert.match(html,/btWrapRtl\(ctx,reportReadingNote\+' '\+notice,contentWidth\)/);
 assert.match(html,/escapeHtml\(reportReadingNote\+' '\+conclusion.disclaimer\)/);
 assert.match(html,/ctx.font='400 17px Arial, sans-serif';ctx.fillStyle='#4d6069'/);
 assert.match(html,/entry.alert\?'#b00020'/);
});
test('all inline scripts retain valid JavaScript',()=>{for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){if(match[1].trim())new Function(match[1]);}});
