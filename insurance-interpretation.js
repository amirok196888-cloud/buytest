(function(root){
  'use strict';
  const negative=/(?:לא|אין|ללא|אפס|0)\s+(?:נמצא[וה]?\s+|נרשמ[וה]?\s+|הוגדר\s+)?(?:תביע|נזק|תאונ|א[וב]בדן|אובדן|ירידת)/;
  const damage=/(?:תאונ[הת]|נזק|תביע[הת]|ירידת\s*ערך|אובדן|אבדן|שלדה|שמא[יו]|פגיע[הת]|הצפה|שריפ[הת])/;
  const coverage=/פרטי\s*(?:הכיסוי|הביטוח)|סכום\s*ביטוח|תוספת\s*ביטוח|תקופת\s*(?:הכיסוי|הביטוח)|פרטי\s*הפוליסה/;
  const format=n=>Number(n).toLocaleString('he-IL');
  function reverseHebrewTokens(line){
    return String(line).split(/(\s+)/).reverse().map(token=>{
      if(!/\p{Script=Hebrew}/u.test(token))return token;
      const dates=[];
      const protectedToken=token.replace(/\d{1,4}(?:[\/.\-:]\d{1,4})+/g,match=>{
        const marker=String.fromCharCode(0xe000+dates.length);dates.push([marker,match]);return marker;
      });
      let reversed=Array.from(protectedToken).reverse().join('');
      for(const [marker,date] of dates)reversed=reversed.replace(marker,date);
      return reversed;
    }).join('');
  }
  function semanticScore(line){
    const patterns=[/מספר\s*(?:הרכב|רכב|רישוי)/,/תביע[הות]?/u,/תאונ[הות]?/u,/נזק[ים]?/u,/ירידת\s*ערך/u,/אובדן|אבדן/u,/גניב[הות]?/u,/שמא[יו]/u,/סכום/u,/תוקנ|הוחלפ|פיצוי/u,/שלדה/u];
    return patterns.reduce((n,re)=>n+(re.test(line)?1:0),0);
  }
  function normalizedLine(line){
    const clean=String(line||'').replace(/[\u200e\u200f\u202a-\u202e]/g,'').trim();
    const reversed=reverseHebrewTokens(clean);
    return semanticScore(reversed)>semanticScore(clean)?reversed:clean;
  }
  function interpret(raw){
    const lines=String(raw||'').split(/\r?\n/).map(normalizedLine).filter(Boolean);
    const text=lines.join('\n');
    const events=[],alerts=[],categories={claims:[],damage:[],depreciation:[],totalLoss:[],theft:[]};
    const uniquePush=(arr,value)=>{value=String(value||'').trim();if(value&&!arr.includes(value))arr.push(value);};
    const plateMatch=text.match(/(?:מספר\s*(?:הרכב|רכב|רישוי)|מס[׳'״"]?\s*רכב|רישוי)\s*[:：\-]?\s*(?:מספר\s*)?([0-9][0-9\- ]{5,10})/u);
    const plate=plateMatch?plateMatch[1].replace(/\D/g,''):null;
    const coverage=/פרטי\s*(?:הכיסוי|הביטוח)|סכום\s*ביטוח|תוספת\s*ביטוח|תקופת\s*(?:הכיסוי|הביטוח)|פרטי\s*הפוליסה/u;
    const claimsHeader=/(?:פירוט|פרטי|היסטוריית|ריכוז|סיכום|טבלת?)\s*[-—:׳'’]*\s*(?:תביעות|נזקים|תאונות)|(?:תביעות|נזקים|תאונות)\s*(?:ביטוחיות|שדווחו)?/u;
    const cleanPatterns=/(?:לא\s+(?:נמצאו?|נרשמו?|הוגשו)\s+(?:כל\s+)?תביעות|אין\s+(?:כל\s+)?תביעות|ללא\s+תביעות|לא\s+(?:נמצא|נרשם)\s+(?:אירועי\s+)?נזק)/u;
    const damageTerms=/(?:תאונ[הות]?|נזק(?:ים)?|תביע[הות]?|פגיע[הות]?|תוקנ|הוחלפ|הצפ[ה]|שריפ[ה]|שלדה)/u;
    const amountRE=/(?:סכום\s*(?:התביעה|תביעה|הפיצוי|פיצוי|ששולם|נזק)|תביעה\s*בסך|תשלום|פיצוי)\s*[:：—-]?\s*(?:₪|ש[״"]?ח|שקל)?\s*([\d,]+(?:\.\d{1,2})?)/u;
    const depRE=/ירידת\s*ערך\s*[:：—-]?\s*(\d+(?:\.\d+)?)\s*%?/u;
    const dateRE=/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/u;
    let inCoverage=false,inClaims=false,sectionSeen=false,explicitClean=false;
    const records=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(coverage.test(line)){inCoverage=true;inClaims=false;continue;}
      if(claimsHeader.test(line)){inClaims=true;inCoverage=false;sectionSeen=true;}
      if(cleanPatterns.test(line)){explicitClean=true;continue;}
      if(inCoverage)continue;
      const totalLoss=/(?:אובדן|אבדן)\s*(?:גמור|להלכה)/u.test(line)&&!/(?:לא|אין|ללא)\s+(?:הוגדר\s+)?(?:אובדן|אבדן)/u.test(line);
      const theft=/(?:גניב[הות]?|ניסיון\s+גניבה|פריצה)/u.test(line)&&!/(?:(?:לא|אין|ללא)\s+(?:(?:נמצאה?|דווחה?|הייתה?)\s+)?(?:אירוע\s+)?(?:גניב[הות]?|פריצה))/u.test(line);
      const dep=line.match(depRE);
      const amount=line.match(amountRE);
      const date=line.match(dateRE);
      const hasDamage=damageTerms.test(line);
      const descriptive=/(?:נזק\s+(?:ל|ב)|תאונה\s+(?:ב|מ|עם)|תוקנ|הוחלפ|פגיעה\s+(?:ב|ל)|ניזוק|תביעה\s+(?:בגין|על|בסך)|הצפה|שריפה)/u.test(line);
      const informative=totalLoss||theft||(dep&&Number(dep[1])>0)||(amount&&Number(amount[1].replace(/,/g,''))>0)||descriptive||(date&&hasDamage);
      if(!informative)continue;
      const source=line.length>350?line.slice(0,350)+'…':line;
      const current=records[records.length-1];
      if(current&&i-current.lastIndex<=2&&current.inClaims===inClaims){
        uniquePush(current.lines,source);current.lastIndex=i;
      }else records.push({lines:[source],lastIndex:i,inClaims});
      if(totalLoss)uniquePush(categories.totalLoss,source);
      if(theft)uniquePush(categories.theft,source);
      if(dep&&Number(dep[1])>0)uniquePush(categories.depreciation,Number(dep[1])+'% — '+source);
      if(hasDamage||descriptive||amount)uniquePush(categories.damage,source);
      if(/תביע[הות]?/u.test(line)||amount||date)uniquePush(categories.claims,source);
    }
    for(const record of records){
      const source=record.lines.join(' | ');
      const amount=source.match(amountRE);
      const depreciation=source.match(depRE);
      const date=source.match(dateRE);
      const thirdParty=/צד\s*ג[׳'’]?/u.test(source);
      events.push({source,date:date?.[0]||'',amount:amount?Number(amount[1].replace(/,/g,'')):null,depreciation:depreciation?Number(depreciation[1]):null,totalLoss:/(?:אובדן|אבדן)\s*(?:גמור|להלכה)/u.test(source),theft:/(?:גניב[הות]?|פריצה)/u.test(source),thirdParty});
    }
    const output=['פענוח עבר ביטוחי — ממצאים שנקראו מהקובץ'];
    output.push('מספר רכב בדוח: '+(plate&&/^\d{7,8}$/.test(plate)?plate:'לא זוהה בטקסט שנקרא'));
    if(events.length){
      output.push('אלה הממצאים שנמצאו בדוח, לפי הפרטים שנקראו:');
      for(const event of events){
        const labels=[];
        if(/תביע[הות]?/u.test(event.source)||event.amount)labels.push('תביעה');
        if(damageTerms.test(event.source))labels.push('נזק או תיקון');
        if(event.depreciation>0)labels.push('ירידת ערך '+event.depreciation+'%');
        if(event.totalLoss)labels.push('אובדן להלכה/גמור');
        if(event.theft)labels.push('גניבה/פריצה');
        if(event.thirdParty)labels.push('צד ג׳');
        output.push('• '+(labels.length?labels.join(' · '):'ממצא ביטוחי')+' — '+event.source);
      }
      if(categories.totalLoss.length)alerts.push('הדוח מציין אובדן להלכה או אובדן גמור. יש לקבל דוח שמאי, מסמכי שיקום ולבדוק את הרכב במכון.');
      if(categories.depreciation.length)alerts.push('הדוח מציין ירידת ערך. יש לברר את סיבת הירידה ולעיין בדוח השמאי ובממצאי הבדיקה.');
      if(categories.theft.length)alerts.push('הדוח מציין גניבה או פריצה. יש לברר את האירוע, התיקונים והמסמכים התומכים.');
      if(categories.totalLoss.length)output.push('רישום אובדן להלכה או אובדן גמור הוא ממצא מהותי. יש לבדוק את סיווג הרכב, לקבל דוח שמאי ומסמכי תיקון ושיקום.');
      if(categories.theft.length)output.push('ברישום גניבה או פריצה יש לברר אם הרכב הוחזר, מה תוקן והאם קיימים מסמכים ותיעוד.');
      if(events.some(e=>e.thirdParty))output.push('ברישום צד ג׳ יש להפריד בין הנזק ששולם לצד ג׳ לבין הנזק לרכב הנבדק; הסכום לבדו אינו מלמד מה תוקן ברכב הזה.');
      if(events.some(e=>e.amount>0))output.push('סכום תביעה לבדו אינו מלמד אילו חלקים נפגעו או מה חומרת הנזק. יש לבקש דוח שמאי, פירוט תיקונים ותמונות.');
      if(events.some(e=>e.depreciation>0))output.push('ירידת ערך היא נתון מסחרי מהדוח; אין להסיק ממנה לבדה אם נפגעו שלדה או מערכות בטיחות.');
    }else if(explicitClean){
      output.push('בדוח נכתב שלא נמצאו תביעות או נזקים מדווחים במסגרת הביטוח.');
    }else{
      output.push(sectionSeen?'זוהה סעיף תביעות, אך לא נמצאו בו שורות שאפשר לייחס בבטחה לאירוע מסוים.':'לא נמצאו בטקסט שנקרא פרטי תביעה או נזק שאפשר לסכם בבטחה.');
      output.push('היעדר רישום בדוח הביטוחי אינו מוכיח שלא היו תאונה או נזק. תיקון פרטי, תיקון ששולם מכיסו של הבעלים או תיקון במוסך לא מורשה עלולים שלא להופיע בדוח.');
    }
    output.push('תיקון פרטי, תיקון ששולם מכיסו של הבעלים או תיקון במוסך לא מורשה עלולים שלא להופיע בדוח הביטוחי; היעדר רישום אינו שולל תאונה או נזק.');
    output.push('בכל מקרה מומלץ לבצע בדיקה מקצועית במכון. הדוח מתעד מידע ביטוחי מדווח ואינו מחליף בדיקה פיזית, דוח שמאי או בירור מסמכים.');
    return {text:output.join('\n'),events,plate:plate&&/^\d{7,8}$/.test(plate)?plate:null,categories,alerts:[...new Set(alerts)],status:events.length?'findings':explicitClean?'explicit-clean':'incomplete'};
  }
  root.BuyTestInsurance={interpret};
})(typeof window==='undefined'?globalThis:window);
