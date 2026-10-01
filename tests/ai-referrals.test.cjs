const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const api=require('../ai-referrals.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function attribution(search,referrer,saved){
  const values=new Map(saved?[['source',JSON.stringify(saved)]]:[]);
  const context={URLSearchParams,URL,Date,location:{search,hostname:'buytest.co.il'},document:{referrer},BuyTestAIReferral:api,BUYTEST_ATTRIBUTION_KEY:'source',BUYTEST_ATTRIBUTION_WINDOW_MS:2592000000,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};
  vm.createContext(context);
  const start=html.indexOf('function buyTestAttributionText(');
  const end=html.indexOf('function buyTestAnalyticsId()',start);
  vm.runInContext(html.slice(start,end),context);
  return JSON.parse(JSON.stringify(context.buyTestTrafficAttribution()));
}
test('recognizes exact AI hosts, never spoofed hosts or ordinary Google',()=>{
  for(const host of ['chatgpt.com','chat.openai.com','gemini.google.com','bard.google.com']) assert.equal(api.capture('',`https://${host}/chat`).utmSource,host);
  for(const host of ['chatgpt.com.evil.test','google.com','notchatgpt.com']) assert.equal(api.capture('',`https://${host}/`),null);
  assert.equal(api.capture('',''),null);
});
test('existing campaign attribution wins over AI referrer',()=>{
  const result=attribution('?gclid=test&utm_source=google','https://chatgpt.com/',null);
  assert.equal(result.trafficSource,'google');
  assert.equal(result.utmSource,'google');
  assert.equal(api.capture('?gbraid=test','https://chatgpt.com/'),null);
});
test('AI arrival replaces old direct source and persists across internal navigation',()=>{
  const first=attribution('','https://gemini.google.com/',{trafficSource:'direct',capturedAt:Date.now()});
  assert.equal(first.utmSource,'gemini.google.com');
  assert.deepEqual(attribution('','https://buytest.co.il/articles/',first),first);
});
test('ChatGPT UTM is retained and labeled without inventing a backend enum',()=>{
  const result=attribution('?utm_source=chatgpt.com','',null);
  assert.equal(result.trafficSource,'other');
  assert.equal(api.label(result.utmSource),'ChatGPT');
});
test('report navigation preserves query attribution and clears only its own hash',()=>{
  const classes=new Set();const nodes={};
  const context={URLSearchParams,location:{hash:'',pathname:'/',search:'?utm_source=chatgpt.com'},plate:()=>'',document:{body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},getElementById:id=>nodes[id]||(nodes[id]={style:{},classList:{add(){}},scrollIntoView(){}})},window:{scrollTo(){}},history:{replaceState:(_,__,url)=>{context.lastUrl=url;context.location.hash=url.includes('#')?'#'+url.split('#')[1]:'';}}};
  vm.createContext(context);
  context.trackBuyTestReportStage=()=>{};
  const start=html.indexOf('function openAfterPage('),end=html.indexOf('async function loadAfterPageVehicle',start);
  vm.runInContext(html.slice(start,end),context);
  context.openAfterPage(false);
  assert.equal(context.lastUrl,'/?utm_source=chatgpt.com#report');
  assert.equal(nodes.afterPage.style.display,'block');assert.ok(classes.has('after-page'));
  context.closeAfterPage(false);assert.equal(context.lastUrl,'/?utm_source=chatgpt.com');assert.ok(!classes.has('after-page'));
  context.location.hash='#redeem=secret&plate=1234567';context.lastUrl='unchanged';context.openAfterPage(false);assert.equal(context.lastUrl,'unchanged');
});
test('blog AI entry persists source for subsequent main-page navigation',()=>{
  const values=new Map();const events=[];
  const context={URL,URLSearchParams,Date,crypto:require('node:crypto').webcrypto,BuyTestAIReferral:api,location:{search:'',pathname:'/articles/test/',hostname:'buytest.co.il'},document:{referrer:'https://chatgpt.com/',title:'test',addEventListener(){}},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},fetch:async(_,opts)=>{events.push(JSON.parse(opts.body));return {};}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../articles/blog-analytics.js'),'utf8'),context);
  const saved=JSON.parse(values.get('buytestTrafficAttributionV1'));
  assert.equal(events[0].utmSource,'chatgpt.com');assert.equal(attribution('','https://buytest.co.il/articles/test/',saved).utmSource,'chatgpt.com');
});
