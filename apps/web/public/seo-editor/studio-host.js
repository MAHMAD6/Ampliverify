/* AmpliVerify host integration for the V13.3 editor (additive; no visual changes).
 * 1. Sidebar and Explore links open the matching AmpliVerify pages.
 * 2. Local (browser-only) images and videos can be sent through the NestJS media
 *    approval pipeline; approved files replace the local blocks (guide §6, phase F).
 * 3. A link to cloud drafts and revision history.
 */
(()=>{
 'use strict';
 const ctx=globalThis.AMPLIVERIFY_CONTEXT;if(!ctx)return;
 const $=id=>document.getElementById(id), article=$('article');
 const ROUTES={
  'Dashboard':'/app','On-Page SEO Audit':'/app/audit','On-Page SEO Editor':'/app/seo-editor','GEO / AI Search':'/app/geo','Content Audit':'/app/content/audit',
  'Website Value Calculator':'/website-value','My Projects':'/app/projects','Reports':'/app/reports','Credits & Usage':'/app/usage','Guides':'/guides','Blog':'/blog',
  'Contact':'/contact','Pricing':'/pricing','Settings':'/app/settings',
  'Digital Assets Dashboard':'/app/assets','My Portfolio':'/app/assets/portfolio','Acquisition Analyzer':'/app/assets/acquisitions','Acquisition History':'/app/assets/acquisitions',
  'Digital Asset Projects':'/app/assets/projects','Improvement Workspace':'/app/assets/improvement','Performance & Reports':'/app/assets/performance',
  'Marketplace Dashboard':'/buyer','Browse Digital Assets':'/buyer/browse','My Inquiries':'/buyer/inquiries','My Purchases':'/buyer/purchases','Transactions':'/buyer/transactions',
  'Refunds & Disputes':'/buyer/support','Sell a Digital Asset':'/seller/listings/new','My Listings':'/seller/listings','Earnings Overview':'/seller/payouts','Earnings Breakdown':'/seller/transactions',
  'Payout Details':'/seller/payouts','Payout History':'/seller/payouts','Payout Methods':'/seller/payouts','Tax & Statements':'/seller/payouts'
 };
 const label=a=>Array.from(a.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()||a.textContent.trim();
 document.querySelectorAll('a[href="#"]').forEach(a=>{const to=ROUTES[label(a).replace(/\s*›\s*$/,'')];if(to)a.setAttribute('href',to);});

 // ── Local media → approved media ──────────────────────────────────────────
 const DB='ampliverify-editor-local-media-v1';
 const api=()=>`${ctx.apiBaseUrl}/api/workspaces/${encodeURIComponent(ctx.workspaceId)}/media`;
 const articleKey=()=>localStorage.getItem('ampliverify:editor:article-key')||'';
 function readLocal(id){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onerror=()=>reject(req.error);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('media'))req.result.createObjectStore('media',{keyPath:'id'});};
  req.onsuccess=()=>{try{const g=req.result.transaction('media','readonly').objectStore('media').get(id);g.onsuccess=()=>resolve(g.result?.file||null);g.onerror=()=>reject(g.error);}catch(e){reject(e);}};});}
 async function call(path,method,body){const r=await fetch(api()+path,{method,headers:{'Authorization':'Bearer '+ctx.accessToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.detail||('Request failed ('+r.status+')'));return d;}
 function send(url,fields,file){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',url,true);x.onload=()=>x.status>=200&&x.status<300?resolve():reject(Error((()=>{try{return JSON.parse(x.responseText).detail}catch{return ''}})()||'Upload failed ('+x.status+')'));
  x.onerror=()=>reject(Error('Upload connection failed'));const f=new FormData();Object.entries(fields||{}).forEach(([k,v])=>f.append(k,v));f.append('file',file);x.send(f);});}
 async function approve(file,say){
  const init=await call('/init','POST',{filename:file.name||'media',content_type:file.type,size:file.size});
  await send(init.upload_url,init.fields,file);
  let s=await call('/complete','POST',{upload_id:init.upload_id,content_type:file.type,size:file.size});
  const until=Date.now()+180000;
  while(['quarantine','processing'].includes(s.status)&&Date.now()<until){say('Verifying and scanning '+(file.name||'media')+'…');await new Promise(r=>setTimeout(r,2000));s=await call('/'+encodeURIComponent(init.upload_id)+'/status','GET');}
  if(s.status!=='approved')throw Error((file.name||'Media')+' was not approved: '+(s.error?.message||s.status));
  return s;
 }
 async function uploadLocal(say){
  const blocks=[...article.querySelectorAll('.media-block[data-av-local-id]')];
  if(!blocks.length){say('No local media in this article.');return;}
  let done=0;
  for(const block of blocks){
   const id=block.dataset.avLocalId,name=block.dataset.avMediaName||'media';
   say('Uploading '+name+' ('+(done+1)+'/'+blocks.length+')…');
   const file=await readLocal(id);if(!file)throw Error(name+' is not available in this browser. Reinsert it from your computer.');
   const named=file.name?file:new File([file],name,{type:file.type});
   const ok=await approve(named,say);
   let poster=null;if(block.dataset.avPosterId){const p=await readLocal(block.dataset.avPosterId);if(p)poster=await approve(p.name?p:new File([p],'poster.jpg',{type:p.type}),say).catch(()=>null);}
   await call('/'+encodeURIComponent(ok.media_id)+'/resolve','POST',{article_key:articleKey(),local_ref:id});
   if(!block.isConnected)continue;
   const media=block.querySelector('img,video');if(media){media.src=ok.url;if(poster&&media.tagName==='VIDEO')media.poster=poster.url;}
   delete block.dataset.avLocalId;delete block.dataset.avPosterId;block.dataset.avMediaId=ok.media_id;
   block.querySelector('.av-media-local-label')?.remove();done++;
   article.dispatchEvent(new Event('input',{bubbles:true}));
  }
  say(done+' media file(s) approved and linked. You can now publish or export.');
 }
 function addButton(dialogId,resultId,before){
  const dialog=$(dialogId);if(!dialog)return;
  const row=dialog.querySelector(before);if(!row)return;
  const b=document.createElement('button');b.type='button';b.className='button ghost';b.textContent='Upload local media for publishing';
  const say=s=>{const r=$(resultId);if(r)r.textContent=s;};
  b.onclick=async()=>{b.disabled=true;try{await uploadLocal(say);}catch(e){say(e.message||'Media upload failed.');}finally{b.disabled=false;}};
  row.append(b);
 }
 addButton('publishDialog','publishResult','.connector-actions');

 // ── Cloud drafts and revisions ────────────────────────────────────────────
 const settings=document.querySelector('#connectorDialog .connector-settings');
 if(settings){const a=document.createElement('a');a.href='/app/editor/studio';a.className='button ghost';a.textContent='Cloud drafts & revisions';a.target='_blank';a.rel='noopener';settings.append(a);}
})();
