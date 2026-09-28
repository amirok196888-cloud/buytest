(function(root){
  'use strict';
  function label(source){
    source=String(source||'').toLowerCase();
    if(['chatgpt','chatgpt.com','chat.openai.com'].includes(source)) return 'ChatGPT';
    if(['gemini','gemini.google.com','bard.google.com'].includes(source)) return 'Gemini';
    return '';
  }
  function capture(search,referrer){
    const params=new URLSearchParams(search);
    // Explicit campaign attribution takes precedence over referrer hints.
    if(['utm_source','utm_medium','utm_campaign','gclid','gbraid','wbraid','fbclid','ttclid'].some(key=>params.has(key))) return null;
    let host='';
    try{host=new URL(referrer).hostname.toLowerCase();}catch(_error){return null;}
    const name=label(host);
    if(!name) return null;
    // Keep the existing backend source enum; expose AI origin in source detail.
    return {trafficSource:'other',utmSource:host,utmMedium:'referral',utmCampaign:'',capturedAt:Date.now()};
  }
  const api={capture,label};
  root.BuyTestAIReferral=api;
  if(typeof module==='object'&&module.exports) module.exports=api;
})(globalThis);
