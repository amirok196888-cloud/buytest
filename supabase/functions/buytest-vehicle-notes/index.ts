// Public vehicle reference data only. JWT verification remains enabled at the gateway.
const origins = new Set(['https://buytest.co.il','https://www.buytest.co.il','https://amirok196888-cloud.github.io']);
const makes = new Set(['Renault','Chevrolet','Mitsubishi','Hyundai','Ford','Toyota','Kia','Honda','Mazda','Nissan','Volkswagen','Skoda','Seat','Peugeot','Citroen','Suzuki','Subaru']);
const cache = new Map<string,{time:number,value:unknown}>();
const pending = new Map<string,Promise<unknown>>();
async function upstream(path:string){
 const response=await fetch('https://api.nhtsa.gov/recalls/'+path,{signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('upstream unavailable');
 const data=await response.json();
 if(!Array.isArray(data.results))throw new Error('invalid response');
 return data.results;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const headers={'Access-Control-Allow-Origin':origin&&origins.has(origin)?origin:'https://buytest.co.il','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply({status:'forbidden'},403);
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({status:'method_not_allowed'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>1024)return reply({status:'invalid'},400);
  const raw=await req.text();if(raw.length>1024)return reply({status:'invalid'},400);
  const {make,model,year}=JSON.parse(raw);
  if(!makes.has(make)||typeof model!=='string'||!/^[a-zA-Z0-9 .-]{1,60}$/.test(model)||!Number.isInteger(year)||year<1990||year>new Date().getUTCFullYear()+1)return reply({status:'unsupported'},400);
  const key=JSON.stringify([make,model,year]);const saved=cache.get(key);
  if(saved&&Date.now()-saved.time<3600000)return reply(saved.value);
  let work=pending.get(key);
  if(!work){
   work=(async()=>{
    const rows=await upstream('recallsByVehicle?'+new URLSearchParams({make,model,modelYear:String(year)}));
    return {status:'ok',market:'US',checkedAt:new Date().toISOString(),items:rows.slice(0,30).map((r:Record<string,unknown>)=>({id:String(r.NHTSACampaignNumber||''),component:String(r.Component||'').slice(0,500),summary:String(r.Summary||'').slice(0,6000),consequence:String(r.Consequence||'').slice(0,3000),remedy:String(r.Remedy||'').slice(0,3000)}))};
   })();pending.set(key,work);
  }
  try{const value=await work;if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(key,{time:Date.now(),value});return reply(value);}finally{pending.delete(key);}
 }catch{return reply({status:'unavailable',items:[]},503);}
});
