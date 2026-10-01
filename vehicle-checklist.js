/* Restored from ce49590 / 2d090b6: original questions, without sequential locks. */
(() => {
  const topics = [
    {id:'seller', title:'שאלות למוכר ליד הרכב', questions:[
      'כמה זמן הרכב אצל המוכר?',
      'האם היו תאונות או תיקונים משמעותיים?',
      'האם המוכר מתחייב בבדיקה לגבי מנוע, גיר, שלדה ותאונות משמעותיות?'
    ], seller:true},
    {id:'license', title:'בדיקת הרישיון מול הרכב והמוכר', questions:[
      'תוקף רישיון הרכב (טסט)', 'תאריך תחילת הבעלות מול דברי המוכר',
      'מספר הבעלים הקודמים והנוכחי', 'זהות המוכר והרשאתו למכור את הרכב',
      'מקוריות הרכב — פרטי, חברה, השכרה או החכרה',
      'התאמת מספר שלדה, מספר מנוע ומידות הצמיגים לרישיון',
      'הקילומטראז׳ ברכב מול הקריאה האחרונה ברישיון או במאגר'
    ]},
    {id:'external', title:'בדיקה חיצונית', questions:[
      'בדוק אם קיימים הבדלי גוון בצבע בין חלקי המרכב',
      'בדוק אם קיימים סימני פתיחה או פירוק בברגי מכסה המנוע ומכסה תא המטען',
      'בדוק אם קיימים סימני פתיחה או פירוק בברגי הדלתות והכנפיים הקדמיות'
    ]},
    {id:'self', title:'בדיקה פנימית ונסיעה קצרה', questions:[
      'מצב הצמיגים תקין ומידותיהם תואמות למידות הרשומות ברישיון הרכב',
      'קיים גלגל רזרבי תקין או ערכת תיקון/ניפוח בהתאם לציוד הרכב',
      'לא נשארו נורות אזהרה חריגות לאחר התנעה', 'המזגן פועל ומקרר',
      'חלונות, מראות וציוד חשמלי בסיסי פועלים', 'הבלאי בתא הנוסעים נראה סביר ביחס לק״מ',
      'בהעברה ל־D ול־R אין מכה או רעש חריג',
      'בוצעה נסיעת מבחן קצרה ולא נשמעו רעשים, נקישות או רעידות חריגות',
      'אין עשן או נזילה בולטים לעין', 'מצב שמן המנוע אינו מציג סימן ברור לבוצה חריגה'
    ]}
  ];
  const states = {unchecked:'לא בדקתי', checked:'נבדק', issue:'דורש בירור'};
  let activePlate = '';
  const root = () => document.getElementById('vehicleChecklist');
  const saved = () => btDossier().sources.checklist?.answers || {};
  function item(key, question, seller=false) {
    const row=document.createElement('div');row.className='btChecklistItem';row.dataset.key=key;row.dataset.question=question;
    const answer=saved()[key]||{};
    const title=document.createElement('label');title.htmlFor='bt-check-'+encodeURIComponent(key);title.textContent=question;
    const select=document.createElement('select');select.id=title.htmlFor;select.setAttribute('aria-label','מצב הבדיקה: '+question);
    Object.entries(states).forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)});
    select.value=answer.state||'unchecked';select.addEventListener('change',capture);
    const note=document.createElement('textarea');note.value=answer.note||'';note.rows=2;
    note.setAttribute('aria-label',(seller?'תשובת המוכר: ':'הערות: ')+question);
    note.placeholder=seller?'תשובת המוכר והנקודות לבירור':'ממצא או הערה (אפשר גם ללא סימון)';note.addEventListener('input',capture);
    row.append(title,select,note);return row;
  }
  function renderQuestions(){
    const host=document.getElementById('preVisitQuestionList');if(!host)return;
    host.replaceChildren(...currentPreVisitQuestions.map(question=>{
      // Use question text as identity: insurance questions may be inserted before the original five.
      const li=document.createElement('li');li.append(item('question:'+question,question,true));return li;
    }));
  }
  function renderTopics(){
    const host=document.getElementById('restoredChecklistTopics');if(!host)return;
    host.replaceChildren(...topics.map(topic=>{
      const details=document.createElement('details');details.className='btChecklistTopic';
      const summary=document.createElement('summary');summary.textContent=topic.title;
      details.append(summary,...topic.questions.map((q,i)=>item(topic.id+':'+i,q,topic.seller)));return details;
    }));
  }
  function capture(){
    if(activePlate!==plate()||!/^\d{7,8}$/.test(activePlate))return;
    const answers={...saved()};
    root().querySelectorAll('.btChecklistItem').forEach(row=>answers[row.dataset.key]={question:row.dataset.question,state:row.querySelector('select').value,note:row.querySelector('textarea').value.trim()});
    const entries=Object.values(answers),done=entries.filter(x=>x.state!=='unchecked').length;
    const text=['דיווח הקונה ותשובות המוכר — אינם ממצאים מאומתים של מכון.',
      ...entries.map(x=>`${x.question} — ${states[x.state]||states.unchecked}${x.note?' · '+x.note:''}`)];
    btSaveSource('checklist',{title:'צ׳קליסט ליד הרכב — דיווח הקונה והמוכר',answers,text:text.join('\n'),
      alerts:entries.filter(x=>x.state==='issue').map(x=>'דיווח לקוח — '+x.question+': '+(x.note||'סומן לבירור ללא פירוט'))});
    document.getElementById('checklistProgress').textContent=`נבדקו או סומנו לבירור ${done} מתוך ${entries.length} סעיפים. אפשר להפיק סיכום גם עם סעיפים שלא נבדקו.`;
    refresh();
  }
  function restore(p){
    activePlate=p;
    renderQuestions();renderTopics();
    const source=btDossier(p).sources.license;
    document.getElementById('btLicenseResults').textContent=source?.text||'';
    document.getElementById('btLicenseReview').hidden=!source;
    document.getElementById('btLicensePreview').hidden=true;
    document.getElementById('btLicenseStatus').textContent='';
    const input=document.getElementById('btLicenseFile');input.value='';input.dataset.vehicle=p;
    document.getElementById('btLicensePlate').value=source?.licensePlate||'';
    document.getElementById('btLicenseKm').value=source?.km??'';
    document.getElementById('btLicenseDate').value=source?.date||'';
    ++btLicenseReadVersion;
    // Close the previous vehicle's checklist and all expanded topics.
    root().hidden=true;
    document.getElementById('checklistSummary').hidden=true;
    document.getElementById('checklistProgress').textContent='אפשר להשלים בדיקות או להפיק סיכום גם עם סעיפים שלא נבדקו.';
  }
  function open(){
    if(window.BuyTestBundle&&!BuyTestBundle.hasChecklist()){void BuyTestBundle.unlock('checklist');return;}
    if(activePlate!==plate())restore(plate());
    root().hidden=false;
    document.getElementById('preVisitSection').classList.add('active');
    document.getElementById('preVisitSection').style.display='block';
    document.getElementById('licenseMatchSection').classList.add('active');
    document.getElementById('licenseMatchSection').style.display='block';
    void trackBuyTestFreeStage('free_questions_opened');
    root().scrollIntoView({behavior:'smooth',block:'start'});
  }
  function refresh(){
    const host=document.getElementById('checklistSummaryContent');if(!host)return;
    host.innerHTML=btUnifiedEntries({preliminary:true}).map(e=>e.heading?`<h3${e.alert?' class="btCritical"':''}>${escapeHtml(e.text)}</h3>`:`<p${e.alert?' class="btCritical"':''}>${escapeHtml(e.text)}</p>`).join('');
  }
  function summarize(){
    if(window.BuyTestBundle&&!BuyTestBundle.hasChecklist()){void BuyTestBundle.unlock('checklist');return;}
    capture();refresh();
    const box=document.getElementById('checklistSummary');box.hidden=false;
    trackBuyTestFreeCompletedOnce(plate());
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.BuyTestChecklist={topics,states,open,restore,capture,refresh,renderQuestions,summarize};
  window.addEventListener('DOMContentLoaded',()=>{
    const holder=document.getElementById('checklistPrimarySteps');
    holder.append(document.getElementById('preVisitSection'),document.getElementById('licenseMatchSection'));
    document.getElementById('licenseMatchSection').open=false;
    document.getElementById('licenseFlowPrompt').hidden=true;
    document.getElementById('licenseFlowPrompt').style.display='none';
    renderQuestions();renderTopics();
  });
})();
