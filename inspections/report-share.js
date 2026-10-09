(function(){
  'use strict';
  var style=document.createElement('style');
  style.textContent='.report-share{margin-top:20px;padding-top:14px;border-top:1px solid #cde4da}.report-share-actions{display:flex;flex-wrap:wrap;gap:10px}.report-share-actions a,.report-share-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 17px;border:0;border-radius:13px;font:700 16px Arial;cursor:pointer;text-decoration:none}.report-facebook{background:#0866ff;color:#fff}.report-copy{background:#e1eaf5;color:#17242b}.report-share-status{display:block;margin-top:8px;color:#526c69;font-size:14px}.report-share textarea{width:100%;min-height:150px;margin-top:10px;font:16px/1.6 Arial}.report-share button:focus-visible{outline:3px solid #f0b930;outline-offset:3px}';
  document.head.appendChild(style);
  document.querySelectorAll('article.example').forEach(function(report){
    if(report.querySelector('.report-share'))return;
    var title=report.querySelector('h3').textContent.trim();
    // A stable title-derived anchor also covers future report cards.
    if(!report.id){var hash=2166136261;for(var i=0;i<title.length;i++)hash=Math.imul(hash^title.charCodeAt(i),16777619);report.id='report-'+(hash>>>0).toString(16);}
    var url='https://buytest.co.il/inspections/#'+encodeURIComponent(report.id);
    var paragraph=report.querySelector('p');
    var summary=paragraph?paragraph.textContent.trim():'';
    var text=title+'\n\n'+summary+'\n\nלצפייה בסיכום הבדיקה המלא באתר BuyTest:\n'+url;
    var box=document.createElement('div');box.className='report-share';box.setAttribute('aria-label','שיתוף סיכום הבדיקה');
    var actions=document.createElement('div');actions.className='report-share-actions';
    var facebook=document.createElement('a');facebook.className='report-facebook';facebook.textContent='שיתוף בפייסבוק';facebook.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);facebook.target='_blank';facebook.rel='noopener noreferrer';
    var copy=document.createElement('button');copy.className='report-copy';copy.type='button';copy.textContent='העתקת תקציר וקישור לפייסבוק';
    var status=document.createElement('span');status.className='report-share-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    var field=document.createElement('textarea');field.readOnly=true;field.hidden=true;field.setAttribute('aria-label','תקציר וקישור להעתקה ידנית');
    copy.addEventListener('click',async function(){
      try{await navigator.clipboard.writeText(text);field.hidden=true;status.textContent='התקציר והקישור הועתקו. אפשר להדביק בפוסט בפייסבוק.';}
      catch(error){field.value=text;field.hidden=false;field.focus();field.select();status.textContent='אפשר להעתיק את התקציר והקישור מהשדה שמתחת.';}
    });
    actions.append(facebook,copy);box.append(actions,status,field);report.appendChild(box);
  });
})();
