(function(root){
'use strict';
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/["'׳״]/g,'').replace(/[^a-z0-9א-ת]+/g,' ').trim();
const makes={Renault:['renault','רנו'],Chevrolet:['chevrolet','שברולט'],Mitsubishi:['mitsubishi','מיצובישי','מיצובשי'],Hyundai:['hyundai','יונדאי'],Ford:['ford','פורד'],Toyota:['toyota','טויוטה'],Kia:['kia','קיה'],Honda:['honda','הונדה'],Mazda:['mazda','מזדה','מאזדה'],Nissan:['nissan','ניסאן'],Volkswagen:['volkswagen','פולקסווגן'],Skoda:['skoda','סקודה'],Seat:['seat','סיאט'],Peugeot:['peugeot','פיגו'],Citroen:['citroen','סיטרואן'],Suzuki:['suzuki','סוזוקי'],Subaru:['subaru','סובארו']};
const models={Mazda3:['mazda3','mazda 3','3','מאזדה 3','מזדה 3'],Megane:['megane','מגאן','מגאן גרנד קופה'],Equinox:['equinox','אקווינוקס','אקוינוקס'],Trax:['trax','טראקס'],Ioniq:['ioniq','איוניק','איוניק היברידית'], 'Eclipse Cross':['eclipse cross','אקליפס קרוס']};
function identity(record={}){
 const rawMake=norm(record.tozeret_nm||record.tozeret_eretz_nm); const rawModel=norm(record.kinuy_mishari||record.degem_nm);
 const make=Object.keys(makes).find(k=>makes[k].some(a=>(' '+rawMake+' ').includes(' '+norm(a)+' ')))||'';
 const model=Object.keys(models).find(k=>models[k].some(a=>norm(a)===rawModel))||'';
 return {make,model,rawModel,year:Number(record.shnat_yitzur)||0,engine:String(record.degem_manoa||'').toUpperCase().trim(),transmission:String(record.transmission_code||'').toUpperCase().trim(),fuel:norm(record.sug_delek_nm)};
}
function match(entry,v){
 if(entry.make!==v.make||entry.model!==v.model||v.year<entry.years[0]||v.year>entry.years[1])return null;
 let uncertain=!!entry.requiresVerification;
 if(entry.excludeHybrid&&/(חשמל|היבריד|hybrid|phev)/.test(v.fuel))return null;
 for(const [field,codes] of [['engine',entry.engineCodes],['transmission',entry.transmissionCodes]]){
  if(!codes)continue;
  if(!v[field]){uncertain=true;continue;}
  if(!codes.some(c=>new RegExp('^'+c+'(?:$|[^A-Z]|[0-9])').test(v[field])))return null;
 }
 if(entry.hybridOnly){if(/חשמל/.test(v.fuel)&&!/(בנזין|היבריד)/.test(v.fuel))return null;if(!/היבריד/.test(v.fuel))uncertain=true;}
 return {entry,uncertain};
}
const api={identity,match,norm};root.BuyTestVehicleNotesCore=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
