/* V13.1 cloud sync. Offline draft remains authoritative until user explicitly chooses otherwise. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), article=$('article');
 let revision=null, initializedFor='', timer=null, inFlight=false, pending=false, blocked=false;
 const key=()=>{let id=localStorage.getItem('ampliverify:editor:article-key');if(!id){id=crypto.randomUUID();localStorage.setItem('ampliverify:editor:article-key',id);}return id;};
 const context=()=>{const token=globalThis.AMPLIVERIFY_TOKEN?.(),workspace=globalThis.AMPLIVERIFY_ACTIVE_WORKSPACE?.(),base=globalThis.AMPLIVERIFY_API_BASE?.();return token&&workspace&&base?{token,workspace,base}:null;};
 const url=c=>`${c.base}/api/workspaces/${encodeURIComponent(c.workspace)}/articles/${encodeURIComponent(key())}`;
 const setStatus=(message)=>{if($('saveStatus')){$('saveStatus').textContent=message;$('saveStatus').style.color='#ae6900';}};
 const request=async(c,method,body)=>{const r=await fetch(url(c),{method,headers:{Authorization:'Bearer '+c.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});return {r,data:await r.json().catch(()=>({}))};};
 async function initialize(c){
  const scope=c.base+'|'+c.workspace+'|'+key();if(initializedFor===scope)return true;
  const {r,data}=await request(c,'GET');
  if(r.status===404){revision=0;initializedFor=scope;return true;}
  if(!r.ok)throw Error('Unable to read server revision ('+r.status+').');
  revision=data.revision;initializedFor=scope;
  // Never silently replace the browser draft. User can explicitly choose to load the server version.
  if(typeof data.html==='string' && data.html!==article.innerHTML){
   blocked=true;setStatus('● Local and cloud drafts differ — choose a version');
   if(confirm('This article differs from its cloud draft. Load the cloud version? Cancel keeps your local changes and prevents cloud overwrite.')){
    article.innerHTML=data.html;
    if(data.metadata?.description && $('metaDescription'))$('metaDescription').value=data.metadata.description;
    if(data.metadata?.keyword && $('primaryKeyword'))$('primaryKeyword').value=data.metadata.keyword;
    article.dispatchEvent(new Event('input',{bubbles:true}));blocked=false;
   }
  }
  return !blocked;
 }
 async function sync(){if(article.querySelector('.media-block[data-av-local-id]')){setStatus('● Local draft saved; upload local media before cloud sync');return;}const c=context();if(!c)return;if(inFlight){pending=true;return;}inFlight=true;pending=false;
  try{if(!await initialize(c))return;
   const {r,data}=await request(c,'PUT',{title:article.querySelector('h1')?.textContent||$('metaTitle')?.value||'Untitled',html:article.innerHTML,description:$('metaDescription')?.value||'',keyword:$('primaryKeyword')?.value||'',expected_revision:revision});
   if(r.status===409){blocked=true;setStatus('● Cloud draft conflict — local copy kept. Refresh to compare versions.');return;}
   if(!r.ok)throw Error(data.message||'Cloud save failed');revision=data.revision;
  }catch(e){setStatus('● Saved locally; cloud sync pending ('+(e.message||'connection error')+')');}
  finally{inFlight=false;if(pending&&!blocked){clearTimeout(timer);timer=setTimeout(sync,1600);}}
 }
 function schedule(){if(!context()||blocked)return;clearTimeout(timer);timer=setTimeout(sync,2200);}
 article.addEventListener('input',schedule);['metaTitle','metaDescription','primaryKeyword'].forEach(id=>$(id)?.addEventListener('input',schedule));$('saveBtn')?.addEventListener('click',schedule);
 globalThis.AmpliVerifyCloudDraft={save:sync,getRevision:()=>revision,clearConflict:()=>{blocked=false;initializedFor='';schedule();}};
})();
