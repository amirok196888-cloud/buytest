/* Landing, free report entry and license comparison. Paid entitlements stay independent. */
function openConsultationPage(){closeAfterPage(false);document.body.classList.add('consultation-page');document.getElementById('consultationPage').hidden=false;window.scrollTo({top:0,behavior:'smooth'});}
function closeConsultationPage(){document.body.classList.remove('consultation-page');document.getElementById('consultationPage').hidden=true;window.scrollTo({top:0,behavior:'smooth'});}
function openBuyTestTour(){const modal=document.getElementById('buytestTour');document.getElementById('buytestTourFrame').src='guided-tour.html';modal.showModal();}
function closeBuyTestTour(){document.getElementById('buytestTour').close();document.getElementById('buytestTourFrame').removeAttribute('src');}
let btLicenseImageUrl='',btLicenseReadVersion=0;
async function readBuyTestLicense(input){
 const file=input.files?.[0],version=++btLicenseReadVersion,status=document.getElementById('btLicenseStatus'),preview=document.getElementById('btLicensePreview');
 document.getElementById('btLicenseReview').hidden=true;document.getElementById('btLicenseResults').textContent='';preview.hidden=true;
 for(const id of ['btLicensePlate','btLicenseKm','btLicenseDate'])document.getElementById(id).value='';
 if(btLicenseImageUrl)URL.revokeObjectURL(btLicenseImageUrl);
 if(!file)return;
 if(!file.type.startsWith('image/')||file.size>12*1024*1024){status.textContent='יש לבחור תמונה בגודל עד 12 MB.';return;}
 const vehicleAtUpload=plate();input.dataset.vehicle=vehicleAtUpload;
 btLicenseImageUrl=URL.createObjectURL(file);preview.src=btLicenseImageUrl;preview.hidden=false;
 status.textContent='קורא את הרישיון…';
 try{
  const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
  const text=await googleVisionRecognize([source],null);
  if(version!==btLicenseReadVersion)return;
  // Only extract values adjacent to explicit labels; never treat an arbitrary number as mileage.
  const plateMatch=text.match(/(?:מספר\s*(?:ה?רכב|רישוי))[^\d\n]{0,12}(\d[\d -]{5,10}\d)/);
  const kmMatch=text.match(/(?:קילומטר[אא-ת׳'״"]*|קילומטראז[׳']?|ק[״"]מ)[^\d\n]{0,18}(\d[\d, ]{1,8}\d)/);
  if(plateMatch)document.getElementById('btLicensePlate').value=plateMatch[1].replace(/\D/g,'').slice(0,8);
  if(kmMatch)document.getElementById('btLicenseKm').value=kmMatch[1].replace(/\D/g,'');
  status.textContent='אשרו את המספרים מול הצילום והשלימו את תאריך המדידה. הזיהוי האוטומטי עלול לטעות.';
 }catch(error){if(version!==btLicenseReadVersion)return;status.textContent='לא הצלחנו לקרוא את התמונה. אפשר למלא את הפרטים מהצילום ולהשוות למאגר.';}
 if(version===btLicenseReadVersion)document.getElementById('btLicenseReview').hidden=false;
}
function buytestMileageComparison(licenseKm,licenseDate,registryKm,registryDate){
 if(licenseKm===''||registryKm===''||!Number.isFinite(Number(licenseKm))||!Number.isFinite(Number(registryKm)))return 'חסר נתון קילומטראז׳ להשוואה. אין אפשרות לקבוע התאמה.';
 const a=Number(licenseKm),b=Number(registryKm),ad=Date.parse(licenseDate),bd=Date.parse(registryDate);
 if(a<0||b<0)return 'יש לבדוק את ערכי הקילומטראז׳ שהוזנו.';
 if(!Number.isFinite(ad)||!Number.isFinite(bd))return 'חסר תאריך מדידה מאומת. הבדל בקילומטראז׳ לבדו אינו מעיד על בעיה.';
 if(ad===bd&&a!==b)return 'צריך בירור: לאותו תאריך מופיעים ערכי קילומטראז׳ שונים. יש לאמת את המספרים מול המקור.';
 if((ad>bd&&a<b)||(bd>ad&&b<a))return 'צריך בירור: הקריאה המאוחרת נמוכה מהקריאה המוקדמת. יש לאמת תאריכים ומספרים; זו אינה קביעה של זיוף.';
 return 'לא זוהתה ירידה בין שתי הקריאות שאושרו. ההשוואה אינה מאמתת את הקילומטראז׳ הנוכחי ברכב.';
}
function compareBuyTestLicense(){
 const result=document.getElementById('btLicenseResults'),lp=document.getElementById('btLicensePlate').value.replace(/\D/g,''),current=plate();
 result.replaceChildren();const add=t=>{const el=document.createElement('p');el.textContent=t;result.appendChild(el)};
 if(current!==document.getElementById('btLicenseFile').dataset.vehicle){add('הרכב שנבחר השתנה. יש להעלות את הרישיון מחדש עבור הרכב הנוכחי.');return;}
 if(!/^\d{7,8}$/.test(lp)){add('יש להזין מספר רכב בן 7 או 8 ספרות כפי שמופיע ברישיון.');return;}
 add(lp===current?'מספר הרכב ברישיון תואם למספר שנבחר.':'צריך בירור: מספר הרכב ברישיון אינו תואם למספר שנבחר.');
 if(lp!==current)return;
 const row=externalVehicleData?.kmHistory?.[0];
 add(buytestMileageComparison(document.getElementById('btLicenseKm').value,document.getElementById('btLicenseDate').value,row?.km??'',row?.date||''));
 add('זהות המוכר, מספר השלדה והמנוע והמצב הפיזי דורשים בדיקה מול המסמכים והרכב. צילום הרישיון לבדו אינו מאמת אותם.');
}
// Paid return keeps its existing verified fulfillment; never grant paid access from free reporting.
const btOriginalActivate=activatePurchasedPlan;
activatePurchasedPlan=function(plan,options){const result=btOriginalActivate(plan,options);if(plan==='prebuy'){openConsultationPage();document.getElementById('prePurchaseConsultationBox').scrollIntoView({behavior:'smooth',block:'start'})}return result};
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('consultationPage').appendChild(document.getElementById('prePurchaseConsultationBox'));document.getElementById('buytestTour').addEventListener('cancel',()=>document.getElementById('buytestTourFrame').removeAttribute('src'));});
