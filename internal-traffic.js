/* Internal visits never enter campaign analytics. Load before any tracking. */
(function(root){
  const key='buytestInternalTrafficV1';
  let excluded=false;
  function mark(){
    excluded=true;
    try{root.localStorage.setItem(key,'1');}catch(_){}
    try{root.sessionStorage.setItem(key,'1');}catch(_){}
  }
  function blocked(){
    const q=new URLSearchParams(root.location?.search||'');
    if(q.has('manager')||q.has('admin')||q.get('mode')==='manager'||q.get('internal_test')==='1'||root.document?.body?.classList.contains('manager-mode')) mark();
    for(const storage of ['localStorage','sessionStorage']){
      try{if(root[storage].getItem(key)==='1') excluded=true;}catch(_){}
    }
    return excluded;
  }
  root.BuyTestInternalTraffic={blocked,mark};
  blocked();
})(globalThis);
