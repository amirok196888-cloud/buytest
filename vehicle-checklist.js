/* Topic-level review; questions are guidance and legacy notes are preserved. */
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
  const states = {unchecked:'טרם סומן', checked:'בדקתי', issue:'דורש בירור'};
  let activePlate = '';
  const root = () => document.getElementById('vehicleChecklist');
  const saved = () => btDossier().sources.checklist?.answers || {};
  function topicAnswer(key, questions, legacyKeys){
    const answers=saved();if(answers[key])return answers[key];
    const legacy=legacyKeys.map((k,i)=>({...answers[k],question:questions[i]}));
    const issues=legacy.some(x=>x.state==='issue');
    const checked=legacy.length>0&&legacy.every(x=>x.state==='checked');
    return {state:issues?'issue':checked?'checked':'unchecked',checked,
      note:legacy.filter(x=>x.note||x.state==='issue').map(x=>x.question+': '+(x.note||'סומן לבירור ללא פירוט')).join('\n')};
  }
  function topicReview(key,title,questions,legacyKeys){
    const row=document.createElement('div');row.className='btChecklistTopicReview';row.dataset.key=key;row.dataset.question=title;
    const answer=topicAnswer(key,questions,legacyKeys);
    const list=document.createElement('ul');list.className='btChecklistGuidance';
    questions.forEach(question=>{const li=document.createElement('li');li.textContent=question;list.append(li);});
    const actions=document.createElement('div');actions.className='btChecklistTopicActions';
    const label=document.createElement('label');label.className='btTopicChecked';
    const check=document.createElement('input');check.type='checkbox';check.checked=answer.checked??answer.state==='checked';check.setAttribute('aria-label','בדקתי: '+title);check.addEventListener('change',capture);
    label.append(check,document.createTextNode('בדקתי'));
    const button=document.createElement('button');button.type='button';button.className='secondary btTopicClarify';button.textContent='יש משהו לבירור';
    const panel=document.createElement('div');panel.className='btTopicClarification';panel.id='bt-clarify-'+encodeURIComponent(key);
    const noteLabel=document.createElement('label');noteLabel.htmlFor=panel.id+'-note';noteLabel.textContent='מה צריך לברר בנושא הזה?';
    const note=document.createElement('textarea');note.id=noteLabel.htmlFor;note.value=answer.note||'';note.rows=3;note.placeholder='כתבו כאן מה דורש בירור';note.addEventListener('input',capture);
    panel.append(noteLabel,note);panel.hidden=answer.state!=='issue'&&!answer.note;
    button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded',String(!panel.hidden));
    row.dataset.issue=String(answer.state==='issue');
    button.addEventListener('click',()=>{panel.hidden=!panel.hidden;row.dataset.issue=String(!panel.hidden||Boolean(note.value.trim()));button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)note.focus();capture();});
    actions.append(label,button);row.append(list,actions,panel);return row;
  }
  function renderQuestions(){
    const host=document.getElementById('preVisitQuestionList');if(!host)return;
    const li=document.createElement('li');li.className='btRegistryTopic';
    li.append(topicReview('topic:registry','שאלות למוכר לפי נתוני הרכב',currentPreVisitQuestions,currentPreVisitQuestions.map(q=>'question:'+q)));
    host.replaceChildren(li);
  }
  function renderTopics(){
    const host=document.getElementById('restoredChecklistTopics');if(!host)return;
    host.replaceChildren(...topics.map(topic=>{
      const details=document.createElement('details');details.className='btChecklistTopic';
      const summary=document.createElement('summary');summary.textContent=topic.title;
      details.append(summary,topicReview('topic:'+topic.id,topic.title,topic.questions,topic.questions.map((q,i)=>topic.id+':'+i)));return details;
    }));
  }
  function capture(){
    if(activePlate!==plate()||!/^\d{7,8}$/.test(activePlate))return;
    const answers={...saved()},entries=[];
    root().querySelectorAll('.btChecklistTopicReview').forEach(row=>{
      const checked=row.querySelector('input[type="checkbox"]').checked,note=row.querySelector('textarea').value.trim();
      const entry={question:row.dataset.question,checked,state:note||row.dataset.issue==='true'?'issue':checked?'checked':'unchecked',note};
      answers[row.dataset.key]=entry;entries.push(entry);
    });
    const done=entries.filter(x=>x.checked||x.state==='issue').length;
    const text=['דיווח הקונה ותשובות המוכר — אינם ממצאים מאומתים של מכון.',
      ...entries.map(x=>`${x.question} — ${states[x.state]||states.unchecked}${x.note?' · '+x.note:''}`)];
    btSaveSource('checklist',{title:'צ׳קליסט ליד הרכב — דיווח הקונה והמוכר',answers,text:text.join('\n'),
      alerts:entries.filter(x=>x.state==='issue').map(x=>'דיווח לקוח — '+x.question+': '+(x.note||'סומן לבירור ללא פירוט'))});
    document.getElementById('checklistProgress').textContent=`נבדקו או סומנו לבירור ${done} מתוך ${entries.length} נושאים. אפשר להפיק סיכום גם עם נושאים שלא סומנו.`;
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
    document.getElementById('checklistProgress').textContent='סמנו בדקתי לכל נושא. אם משהו דורש בירור, פתחו את שדה הבירור באותו נושא.';
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
