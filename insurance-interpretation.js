(function(root){
  'use strict';
  function reverseHebrewTokens(line){
    return String(line).split(/(\s+)/).reverse().map(token=>{
      if(!/\p{Script=Hebrew}/u.test(token))return token;
      const saved=[];
      const protectedToken=token.replace(/\d{1,4}(?:[\/.\-:]\d{1,4})+/g,match=>{
        const mark=String.fromCharCode(0xe000+saved.length);saved.push([mark,match]);return mark;
      });
      let value=Array.from(protectedToken).reverse().join('');
      for(const [mark,date] of saved)value=value.replace(mark,date);
      return value;
    }).join('');
  }
  function semanticScore(value){
    const terms=[/מס(?:פר)?\s*[׳״"]?\s*(?:רכב|רישוי)/u,/תביע(?:ה|ות)/u,/תאונ[הות]?/u,/נזק(?:ים)?/u,/ירידת\s*ערך/u,/אובדן|אבדן/u,/גניב[הות]?/u,/שמא[יו]/u,/סכום/u,/מבוטח|ניזוק|צד\s*ג/u,/תוקנ|הוחלפ|פיצוי/u,/שלדה/u];
    return terms.reduce((score,pattern)=>score+(pattern.test(value)?1:0),0);
  }
  function normalizeLine(line){
    const clean=String(line||'').replace(/[\u200e\u200f\u202a-\u202e]/g,'').trim();
    const reverse=reverseHebrewTokens(clean);
    return semanticScore(reverse)>semanticScore(clean)?reverse:clean;
  }
  const dateRE=/(?<!\d)\d{1,2}[/.\\-]\d{1,2}[/.\\-]\d{2,4}(?!\d)/g;
  const claimNumberRE=/(?<!\d)\d{9,13}(?!\d)/g;
  const longIdRE=/(?<!\d)\d{9,16}(?!\d)/g;
  const moneyTokenRE=/(?<!\d)(?:\d{1,3}(?:,\d{3})+|\d{2,})(?:\.\d{1,2})?(?!\d)/g;
  function firstMatch(value,pattern){const m=String(value||'').match(pattern);return m?m[0]:'';}
  function fullDate(value){
    const match=String(value||'').match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if(!match)return '';
    let year=Number(match[3]);if(match[3].length===2)year+=year>=70?1900:2000;
    return String(match[1]).padStart(2,'0')+'/'+String(match[2]).padStart(2,'0')+'/'+year;
  }
  function dateOrder(value){const date=fullDate(value);const match=date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return match?Date.UTC(Number(match[3]),Number(match[2])-1,Number(match[1])):Number.MAX_SAFE_INTEGER;}
  function unique(values){return [...new Set(values.filter(Boolean))];}
  function extractPlate(lines){
    const label=/(?:מס(?:פר)?\s*['׳״”"']?\s*(?:ה?רכב|רישוי|רישיון)|(?:ה?רכב|רישוי|רישיון)\s*מס(?:פר)?|לוחית\s*(?:ה?רישוי|רישוי)?|vehicle\s*(?:registration|plate|number)|(?:plate|registration)\s*(?:no\\.?|number))/iu;
    const number=/(?<!\d)(\d(?:[\s.-]?\d){6,7})(?!\d)/g;
    let best=null;
    for(let i=0;i<lines.length;i++){
      const from=Math.max(0,i-1),to=Math.min(lines.length,i+2);
      const context=lines.slice(from,to).join(' ');
      const labels=Array.from(context.matchAll(new RegExp(label.source,'giu')));
      if(!labels.length)continue;
      const numbers=Array.from(context.matchAll(number)).map(match=>({value:match[1].replace(/\D/g,''),position:match.index+(match[0].length-match[1].length)})).filter(item=>/^\d{7,8}$/.test(item.value));
      for(const labelMatch of labels)for(const candidate of numbers){
        const distance=Math.abs(candidate.position-labelMatch.index);
        if(!best||distance<best.distance)best={value:candidate.value,distance};
      }
    }
    return best?.value||'';
  }
  function extractQueryDate(lines){
    for(const line of lines){
      if(/תאריך\s*(?:ה)?שאילתה|מועד\s*(?:ה)?שאילתה/u.test(line)){
        const date=firstMatch(line,dateRE);if(date)return fullDate(date)||date;
      }
    }
    return '';
  }
  function parseParty(line){
    if(/(?:תביעת?\s*)?(?:ניזוק|צד\s*ג[׳'״"]?)/u.test(line))return 'תביעת צד ג׳';
    if(/(?:לרכב\s*)?המבוטח|בגין\s+נזק\s+לרכב/u.test(line))return 'נזק לרכב המבוטח';
    return 'סוג התביעה לא נקרא';
  }
  function parseDamage(line){
    if(/אובדן\s*גמור.{0,15}להלכה|אובדן\s*להלכה|אבדן\s*להלכה/u.test(line))return 'אובדן להלכה';
    if(/אובדן\s*גמור|אבדן\s*גמור/u.test(line))return 'אובדן גמור';
    if(/(?:גניב[הות]?|ניסיון\s+גניבה|פריצה)/u.test(line))return 'גניבה או פריצה';
    if(/נזק\s*חלקי/u.test(line))return 'נזק חלקי';
    if(/נזק/u.test(line))return 'נזק (הסיווג המלא לא נקרא)';
    return 'סוג הנזק לא נקרא';
  }
  function parseMoneyValues(line,claimNumber,plate){
    const withoutDates=String(line||'').replace(dateRE,' ');
    return unique([...withoutDates.matchAll(moneyTokenRE)].map(m=>m[0])
      .filter(value=>{
        const number=Number(value.replace(/,/g,''));
        return number>=100&&number<100000000&&value!==claimNumber&&value!==plate&&value.length<=10;
      }));
  }
  function interpret(raw){
    const lines=String(raw||'').replace(/\r/g,'').split(/\n+/).map(normalizeLine).filter(Boolean);
    const text=lines.join('\n');
    const plate=extractPlate(lines);
    const queryDate=extractQueryDate(lines);
    const claimsHeaderRE=/(?:טבלה\s*ב|פירוט\s*(?:פרטי\s*)?תביע(?:ה|ות)|פרטי\s*התביע(?:ה|ות)|טבלת?\s*תביע(?:ה|ות)|תביעות\s*(?:ביטוחיות|שדווחו)?)/u;
    const coverageRE=/(?:טבלה\s*א|פרטי\s*(?:הכיסוי|הביטוח)|תקופת\s*(?:הכיסוי|הביטוח)|סכום\s*ביטוח)/u;
    let tableStart=-1;
    for(let i=0;i<lines.length;i++){
      if(claimsHeaderRE.test(lines[i])){tableStart=i+1;break;}
    }
    const explicitClean=/(?:לא\s+(?:נמצאו?|נרשמו?|הוגשו|דווחו?|מופיעות?)\s+(?:כל\s+)?תביעות|אין\s+(?:כל\s+)?תביעות|ללא\s+תביעות|לא\s+(?:נמצא|נרשם|דווח)\s+(?:אירועי\s+)?נזק|לא\s+קיימות\s+תביעות)/u.test(text);
    const claims=[];
    const seen=new Map();
    if(tableStart>=0){
      for(let i=tableStart;i<lines.length;i++){
        const line=lines[i];
        if(coverageRE.test(line)&&i>tableStart)break;
        if(/(?:המשך\s+בדף|טבלה\s*ג|הערות\s+כלליות)/u.test(line))break;
        if(/תאריך\s*(?:ה)?שאילתה/u.test(line))continue;
        const claimNumbers=unique([...line.matchAll(claimNumberRE)].map(m=>m[0]));
        const longIds=unique([...line.matchAll(longIdRE)].map(m=>m[0]));
        const neighborTexts=[];
        const anchorHasDate=Boolean(firstMatch(line,dateRE));
        for(const direction of [-1,1]){
          for(let step=1;step<=5;step++){
            const neighborIndex=i+direction*step;
            if(neighborIndex<0||neighborIndex>=lines.length)break;
            const neighbor=lines[neighborIndex];
            if(/(?<!\d)\d{9,13}(?!\d)/.test(neighbor)||coverageRE.test(neighbor)||/(?:המשך\s+בדף|טבלה\s*ג|הערות\s+כלליות)/u.test(neighbor))break;
            if(new RegExp(dateRE.source).test(neighbor)){
              if(direction<0&&!anchorHasDate)neighborTexts.push(neighbor);
              break;
            }
            neighborTexts.push(neighbor);
          }
        }
        const rowText=[...neighborTexts,line].join(' ');
        const date=fullDate(firstMatch(line,dateRE)||firstMatch(rowText,dateRE))||firstMatch(line,dateRE)||firstMatch(rowText,dateRE);
        const party=parseParty(rowText),damage=parseDamage(rowText);
        const partyKnown=party!=='סוג התביעה לא נקרא';
        const damageKnown=damage!=='סוג הנזק לא נקרא';
        if(!claimNumbers.length||(!partyKnown&&!damageKnown&&!date))continue;
        const claimNumber=claimNumbers[0];
        const policyNumber=longIds.find(value=>value!==claimNumber)||'';
        const percentSource=/\d{1,2}(?:[.,]\d+)?\s*%/.test(line)?line:rowText;
        const percentages=unique([...percentSource.matchAll(/(?<!\d)\d{1,2}(?:[.,]\d+)?\s*%/g)].map(m=>m[0].replace(/\s/g,'')));
        const amountSource=rowText;
        const amountValues=parseMoneyValues(amountSource,claimNumber,plate);
        const status=unique([/סגורה|סגור/u.test(line)?'סגורה':'',/פתוחה|פתוח/u.test(line)?'פתוחה':'']);
        const insurer=/פניקס|פיניקס/u.test(line)?'הפניקס':/הראל/u.test(line)?'הראל':/מנורה/u.test(line)?'מנורה':firstMatch(line,/(?:כלל|מגדל|הכשרה|איילון|שומרה)/u);
        const row={
          date:date||'',
          claimNumber,
          policyNumber,
          party,
          damage,
          amounts:amountValues,
          depreciationRate:percentages.join(', '),
          theft:/גניב[הות]?|פריצה/u.test(line),
          status:status.join(' / ')||'הסטטוס לא נקרא',
          insurer:insurer||'חברת הביטוח לא נקראה',
          source:rowText
        };
        const key=[row.date,row.claimNumber,row.party].join('|');
        if(seen.has(key)){
          const existing=seen.get(key);
          existing.amounts=unique(existing.amounts.concat(row.amounts));
          existing.status=unique(existing.status.split(' / ').concat(status)).join(' / ');
          if(existing.damage==='סוג הנזק לא נקרא'&&damageKnown)existing.damage=damage;
          if(!existing.policyNumber&&policyNumber)existing.policyNumber=policyNumber;
          if(!existing.depreciationRate&&row.depreciationRate)existing.depreciationRate=row.depreciationRate;
          existing.theft=existing.theft||row.theft;
          if(existing.insurer==='חברת הביטוח לא נקראה'&&insurer)existing.insurer=insurer;
          existing.recordCount++;
        }else{
          row.recordCount=1;seen.set(key,row);claims.push(row);
        }
      }
    }
    const byDate=new Map();
    for(const claim of claims){
      const date=claim.date||'תאריך האירוע לא נקרא';
      const eventKey=claim.date||'לא-ידוע:'+claim.claimNumber;
      if(!byDate.has(eventKey))byDate.set(eventKey,{date,claims:[]});
      byDate.get(eventKey).claims.push(claim);
    }
    const events=[...byDate.values()].sort((a,b)=>dateOrder(a.date)-dateOrder(b.date));
    const summary={
      eventCount:events.length,
      claimCount:claims.length,
      insuredClaims:claims.filter(c=>c.party==='נזק לרכב המבוטח').length,
      thirdPartyClaims:claims.filter(c=>c.party==='תביעת צד ג׳').length,
      totalLossClaims:claims.filter(c=>/אובדן/u.test(c.damage)).length,
      partialDamageClaims:claims.filter(c=>c.damage==='נזק חלקי').length,
      theftClaims:claims.filter(c=>c.theft||c.damage==='גניבה או פריצה').length,
      depreciationClaims:claims.filter(c=>Boolean(c.depreciationRate)||c.amounts.length>1).length,
      sourceRecordCount:claims.reduce((n,c)=>n+c.recordCount,0),
      claimDates:unique(claims.map(c=>c.date))
    };
    const totalLossMentioned=/(?:אובדן|אבדן)\s*(?:גמור.{0,20}להלכה|להלכה|גמור)/u.test(text);
    const unlinkedTotalLoss=totalLossMentioned&&!claims.some(c=>/אובדן/u.test(c.damage));
    summary.totalLossMentioned=totalLossMentioned;
    summary.unlinkedTotalLoss=unlinkedTotalLoss;
    const alerts=[];
    if(summary.totalLossClaims)alerts.push('בדוח מופיע רישום של אובדן גמור או אובדן להלכה. יש לעיין בדוח השמאי ובמסמכי השיקום.');
    if(unlinkedTotalLoss)alerts.push('זוהה בטקסט הדוח אזכור של אובדן להלכה/אובדן גמור, אך לא ניתן לשייך אותו בבטחה לשורת תביעה. יש לבדוק את שורת המקור לפני הסקת מסקנה.');
    if(summary.theftClaims)alerts.push('בדוח מופיע רישום גניבה או פריצה. יש לברר את האירוע, התיקונים והמסמכים התומכים.');
    if(claims.some(c=>c.depreciationRate||c.amounts.length>1))alerts.push('בדוח מופיעים נתוני תשלום או ירידת ערך; יש לאמת את משמעות כל סכום מול כותרות הטבלה ודוח השמאי.');
    const output=['פענוח דוח עבר ביטוחי'];
    output.push('מספר רכב בדוח: '+(plate||'לא זוהה בשורות שנקראו'));
    if(queryDate)output.push('תאריך השאילתה בדוח: '+queryDate);
    if(events.length){
      output.push('נמצאו '+summary.eventCount+' מועדי אירוע ו־'+summary.claimCount+' רשומות תביעה. רשומות מאותו תאריך מוצגות יחד, תוך הפרדה בין המבוטח לצד ג׳.');
      for(const event of events){
        output.push('אירוע — '+event.date);
        for(const claim of event.claims){
          output.push('• '+claim.party+' | תביעה '+claim.claimNumber+' | '+claim.damage+
            (claim.amounts.length?' | סכומים בטבלה: '+claim.amounts.map(v=>'₪'+v).join(', '):'')+
            (claim.depreciationRate?' | ירידת ערך: '+claim.depreciationRate:'')+
            ' | '+claim.status+' | '+claim.insurer);
        }
      }
      output.push('סיכום: '+summary.eventCount+' מועדי אירוע; '+summary.claimCount+' תביעות ייחודיות מתוך '+summary.sourceRecordCount+' שורות מקור; '+summary.insuredClaims+' תביעות הקשורות לרכב המבוטח; '+summary.thirdPartyClaims+' תביעות צד ג׳; '+summary.totalLossClaims+' רישומי אובדן; '+summary.partialDamageClaims+' רישומי נזק חלקי; '+summary.theftClaims+' רישומי גניבה/פריצה.');
      output.push('הסכומים מוצגים כפי שנקראו, בלי לשייך אותם לסוג תשלום כאשר כותרת העמודה לא נקראה בבטחה. אין לחבר תשלומים של צד ג׳ לתשלומים עבור הרכב המבוטח.');
    }else if(explicitClean){
      output.push('בדוח נכתב שלא נמצאו תביעות מדווחות בתקופה שנבדקה.');
    }else{
      output.push(tableStart>=0?'זוהתה טבלת תביעות, אך לא ניתן היה לשייך בבטחה את השדות לתאריך ולרשומת תביעה.':'לא זוהתה טבלת תביעות קריאה בקובץ.');
      output.push('כדי למנוע שיוך שגוי, פרטי שורה שלא פוענחו אינם מוצגים כממצא. כדאי להעלות PDF מקורי או צילום חד, ישר ומלא של הטבלה.');
    }
    output.push('דוח זה מציג תביעות שדווחו לחברות הביטוח. תיקונים פרטיים, תיקונים שלא דרך הביטוח ותיקונים במוסך לא מורשה עלולים שלא להופיע בו; היעדר רישום אינו שולל נזק או תאונה. לכן עדיין מומלץ לבצע בדיקה במכון.');
    output.push('בכל מקרה מומלץ לבצע בדיקה מקצועית במכון. הדוח אינו מחליף בדיקה פיזית, דוח שמאי או אימות מול מסמכי המקור.');
    return {text:output.join('\n'),rawText:String(raw||''),plate,queryDate,claims,events,summary,alerts,status:claims.length?'findings':explicitClean?'explicit-clean':'incomplete'};
  }
  root.BuyTestInsurance={interpret};
})(typeof window==='undefined'?globalThis:window);

