(function(root){
  'use strict';
  const negative=/(?:לא|אין|ללא|אפס|0)\s+(?:נמצא[וה]?\s+|נרשמ[וה]?\s+|הוגדר\s+)?(?:תביע|נזק|תאונ|א[וב]בדן|אובדן|ירידת)/;
  const damage=/(?:תאונ[הת]|נזק|תביע[הת]|ירידת\s*ערך|אובדן|אבדן|שלדה|שמא[יו]|פגיע[הת]|הצפה|שריפ[הת])/;
  const coverage=/פרטי\s*(?:הכיסוי|הביטוח)|סכום\s*ביטוח|תוספת\s*ביטוח|תקופת\s*(?:הכיסוי|הביטוח)|פרטי\s*הפוליסה/;
  const format=n=>Number(n).toLocaleString('he-IL');
  function interpret(raw){
    const lines=String(raw||'').replace(/[\u200e\u200f]/g,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const events=[],alerts=[];let inClaims=false,inCoverage=false,sectionSeen=false,explicitClean=false;
    const evidence=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(coverage.test(line)){inClaims=false;inCoverage=true;continue;}
      const header=/(?:טבלה\s*[בב׳'’]|פירוט|פרטי|היסטוריית|ריכוז|סיכום)\s*[-—:׳'’]*\s*(?:תביעות|נזקים|תאונות)|טבלה\s*ב.*(?:תביע|נזק)/.test(line);
      if(header){inClaims=true;inCoverage=false;sectionSeen=true;}
      if(inCoverage&&!header)continue;
      if(/(?:לא\s+(?:נמצא[וה]?|נרשמ[וה]?|הוגשו)|אין|ללא)\s+(?:כל\s+)?תביעות|לא\s+(?:נמצא[וה]?|נרשמ[וה]?)\s+(?:אירועי\s+)?נזק/.test(line)){explicitClean=true;continue;}
      if(!damage.test(line)||header)continue;
      // Header labels and coverage history alone are not evidence of an accident.
      if(/^(?:סוג\s*(?:נזק|תביעה)|תאריך\s*(?:נזק|תביעה)|סכום\s*(?:תביעה|פיצוי)|ירידת\s*ערך|אובדן\s*(?:גמור|להלכה))\s*[:?]?\s*$/.test(line))continue;
      const positiveLoss=!/(?:לא|אין|ללא)\s+(?:הוגדר\s+)?(?:אובדן|אבדן)/.test(line)&&/(?:הוגדר|נקבע|סוג\s*(?:הנזק|נזק|התביעה|תביעה)\s*[:—-]|סטטוס\s*[:—-]|כן\s*[:—-]?)\s*(?:כ|ה)?(?:אובדן|אבדן)\s*(?:גמור|להלכה)|(?:אובדן|אבדן)\s*(?:גמור|להלכה)\s*[:—-]?\s*כן/.test(line);
      const amountMatch=line.match(/(?:סכום\s*(?:התביעה|תביעה|הפיצוי|פיצוי|ששולם|נזק)|תביעה\s*בסך|תשלום|פיצוי)\s*[:—-]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:₪|ש[״"]?ח|שקל)?/);
      const reduction=line.match(/ירידת\s*ערך\s*[:—-]?\s*(\d+(?:\.\d+)?)\s*%/);
      const date=line.match(/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/);
      const narrative=!/^(?:לא|אין|ללא)\s+(?:נמצא[וה]?\s+|נרשמ[וה]?\s+)?(?:נזק|תאונ)/.test(line)&&/(?:נזק\s+(?:ל|ב)|תאונה\s+(?:ב|מ|עם)|תוקנ|הוחלפ|פגיעה\s+(?:ב|ל)|ניזוק|תביעה\s+(?:בגין|על|בסך)|הצפה\s*(?:[:—-]|ברכב)|שריפה\s*(?:[:—-]|ברכב))/.test(line);
      if(!positiveLoss&&!(amountMatch&&Number(amountMatch[1].replace(/,/g,''))>0)&&!(reduction&&Number(reduction[1])>0)&&!narrative)continue;
      const amount=amountMatch?Number(amountMatch[1].replace(/,/g,'')):null;
      const depreciation=reduction?Number(reduction[1]):null;
      const thirdParty=/צד\s*ג[׳'’]?/.test(line);
      const context=line.length>450?line.slice(0,450)+'…':line;
      if(!evidence.includes(context)){evidence.push(context);events.push({source:context,date:date?.[0]||'',amount,depreciation,totalLoss:positiveLoss,thirdParty});}
      if(positiveLoss)alerts.push('בדוח הביטוחי החיצוני מופיע רישום מפורש של אובדן גמור או אובדן להלכה. יש לדרוש דוח שמאי ותיעוד שיקום.');
      if(depreciation>0)alerts.push('בדוח הביטוחי החיצוני נרשמה ירידת ערך של '+depreciation+'%. יש לברר את הפגיעה ואת משמעותה המסחרית.');
    }
    const output=['פענוח עבר ביטוחי — מקור: דוח שהלקוח העלה'];
    if(events.length){
      output.push('ממצאי תאונות ונזקים שנקראו מהדוח:');
      for(const e of events){
        output.push('• לפי הדוח: '+e.source);
        if(e.thirdParty)output.push('משמעות: הרשומה מתייחסת לצד ג׳; אין להסיק ממנה לבדה מה היקף הנזק לרכב הנבדק.');
        else if(e.totalLoss)output.push('משמעות: סיווג אובדן הוא רישום מהותי. יש לברר אילו מערכות נפגעו, לקבל דוח שמאי ותיעוד תיקון ולבדוק את איכות השיקום במכון.');
        else if(e.depreciation>0)output.push('משמעות: ירידת ערך של '+e.depreciation+'% מצביעה על השפעה מסחרית שנקבעה בדוח; יש לברר את סיבתה ואת אזורי התיקון. אין להסיק ממנה לבדה שהשלדה נפגעה.');
        else if(e.amount>0)output.push('משמעות: דווח תשלום של '+format(e.amount)+' ₪. הסכום לבדו אינו קובע אם הפגיעה קוסמטית או מבנית. יש לקבל פירוט חלקים, דוח שמאי ותמונות לפני התיקון.');
        else output.push('משמעות: תואר אירוע נזק או תיקון. יש להשוות את האזור המתואר לממצאי מכון הבדיקה ולתיעוד השמאי; חומרת הפגיעה אינה נקבעת מהתיאור בלבד.');
      }
      output.push('בהשוואה לדוח המכון: יש לבדוק התאמה באזורי הפגיעה, בחלקים שהוחלפו ובממצאי המרכב והשלדה. היעדר אזכור במכון אינו מבטל אירוע שמופיע בדוח הביטוחי.');
    }else if(explicitClean){
      output.push('בדוח נכתב במפורש שלא נמצאו תביעות או נזקים מדווחים. אין בכך הוכחה שלא הייתה תאונה או תיקון פרטי שלא דווח לביטוח.');
    }else{
      output.push(sectionSeen?'זוהה סעיף תביעות, אך לא נקראו ממנו פרטי אירועים באופן שמאפשר פענוח מהימן.':'לא זוהו פרטי תאונות או נזקים שניתן לפענח. טבלת כיסויים או ביטוח מקיף אינה דוח תביעות.');
      output.push('יש להעלות צילום ברור של טבלת התביעות והנזקים, כולל כותרות העמודות, או PDF מקורי. אין להסיק שהעבר הביטוחי נקי מהמידע שנקרא.');
    }
    output.push('הפענוח מבוסס על הטקסט שנקרא מהדוח; הוא אינו מחליף דוח שמאי או בדיקה מקצועית במכון.');
    return {text:output.join('\n'),events,alerts:[...new Set(alerts)],status:events.length?'findings':explicitClean?'explicit-clean':'incomplete'};
  }
  root.BuyTestInsurance={interpret};
})(typeof window==='undefined'?globalThis:window);
