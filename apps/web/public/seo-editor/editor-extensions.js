/* AmpliVerify V5 optional extensions. Does not replace the original formatting or CMS controllers. */
(() => {
 'use strict';
 const el = id => document.getElementById(id), article=el('article');
 const notify = () => article.dispatchEvent(new Event('input',{bubbles:true}));
 const headings = () => [...article.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 const topBlock = node => {let n=node?.nodeType===1?node:node?.parentElement;while(n&&n.parentElement!==article)n=n.parentElement;return n?.parentElement===article?n:null;};
 let selectedRange=null, aiPending=null, aiBusy=false, dragInfo=null, dragOver=null;
 document.querySelectorAll('#aiRewriteBtn,[data-ai],#aiWriteBtn,[data-editor-tab="ask"]').forEach(btn=>btn.addEventListener('pointerdown',()=>{
   const s=window.getSelection(); if(s?.rangeCount && article.contains(s.anchorNode))selectedRange=s.getRangeAt(0).cloneRange();
 },true));
 const selectedText = () => selectedRange && article.contains(selectedRange.commonAncestorContainer) ? selectedRange.toString().trim() : '';
 function showAI(task){
   el('aiTask').value=task;el('aiTopic').value=el('metaTitle').value || article.querySelector('h1')?.textContent || '';
   el('aiKeyword').value=el('primaryKeyword').value || '';
   el('aiStatus').textContent=''; el('aiDialog').showModal();
 }
 el('aiWriteBtn').addEventListener('click',()=>showAI('article'));
 // Capture-phase handlers preempt V4 placeholder callbacks without modifying those functions.
 const aiButtonHandlers=[[el('aiRewriteBtn'),'rewrite'],...([...document.querySelectorAll('[data-ai]')].map(b=>[b,({'Improve SEO':'improve_seo','Expand':'expand','Shorten':'shorten','Change Tone':'tone'})[b.dataset.ai]||'rewrite'])),[document.querySelector('[data-editor-tab="ask"]'),'article']];
 aiButtonHandlers.forEach(([button,task])=>button.addEventListener('click',e=>{e.stopImmediatePropagation();showAI(task);},true));
 el('aiCancel').onclick=()=>el('aiDialog').close();el('aiReject').onclick=()=>el('aiReviewDialog').close();
 function safeGeneratedHtml(html){
   const doc=new DOMParser().parseFromString(`<section>${html}</section>`,'text/html');
   const container=doc.body.firstElementChild;
   const allowed=new Set(['H1','H2','H3','H4','H5','H6','P','STRONG','B','EM','I','U','UL','OL','LI','BLOCKQUOTE','A','BR']);
   const forbidden=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','FORM','SVG','MATH','VIDEO','IMG','TABLE','TEMPLATE']);
   function scrub(parent){[...parent.childNodes].forEach(n=>{
     if(n.nodeType===8){n.remove();return;}
     if(n.nodeType!==1)return;
     if(forbidden.has(n.tagName)){n.remove();return;}
     if(!allowed.has(n.tagName)){scrub(n);n.replaceWith(...n.childNodes);return;}
     [...n.attributes].forEach(a=>n.removeAttribute(a.name));scrub(n);
   });}
   scrub(container);return container.innerHTML;
 }
 const beforeSnapshot = () => article.innerHTML;
 async function generate(){
   if(aiBusy)return;
   const task=el('aiTask').value, selected=selectedText();
   if(['rewrite','improve_seo','expand','shorten','tone','refresh'].includes(task) && !selected){el('aiStatus').textContent='Select text in the article before using this editing action.';return;}
   const base=(el('backendUrl')?.value||'http://127.0.0.1:3000').replace(/\/$/,'');
   const token=globalThis.AMPLIVERIFY_TOKEN?.() || el('backendKey')?.value?.trim(), workspace=el('workspaceId')?.value?.trim();
   if(!token||!workspace){el('aiStatus').textContent='Configure Backend API, workspace and bearer token in Connections first. OpenAI keys belong on the server, never in the browser.';return;}
   aiBusy=true;el('aiGenerate').disabled=true;el('aiStatus').textContent='Generating securely through the AmpliVerify backend…';
   const snapshot=beforeSnapshot(), range=selectedRange?.cloneRange();
   try{
     const res=await fetch(`${base}/api/workspaces/${encodeURIComponent(workspace)}/ai/generate`,{
       method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
       body:JSON.stringify({task,topic:el('aiTopic').value,keyword:el('aiKeyword').value,tone:el('aiTone').value,target_words:Number(el('aiWords').value),instructions:el('aiInstructions').value,selected_text:selected,article_excerpt:article.innerText.slice(0,6000)})
     });
     let data;try{data=await res.json();}catch{throw new Error('Server returned a non-JSON response.');}
     if(!res.ok)throw new Error(typeof data.detail==='string'?data.detail:'AI request failed ('+res.status+').');
     const proposed=safeGeneratedHtml(data.html||'');if(!proposed.trim())throw new Error('AI returned no usable content.');
     aiPending={task,snapshot,range,html:proposed, selected, request: {task,topic:el('aiTopic').value,keyword:el('aiKeyword').value,tone:el('aiTone').value,target_words:Number(el('aiWords').value),instructions:el('aiInstructions').value}};
     el('aiBefore').textContent=task==='article'||task==='outline'?article.innerText.slice(0,12000):selected;
     el('aiAfter').innerHTML=proposed;
     el('aiReviewStatus').textContent='Draft only. Accept to insert. No automatic publishing.';
     el('aiDialog').close();el('aiReviewDialog').showModal();
   }catch(error){el('aiStatus').textContent=error.message || 'AI request failed.';}
   finally{aiBusy=false;el('aiGenerate').disabled=false;}
 }
 el('aiForm').addEventListener('submit',e=>{e.preventDefault();generate();});
 el('aiRegenerate').addEventListener('click',()=>{el('aiReviewDialog').close();el('aiDialog').showModal();generate();});
 function insertHtmlAtRange(range,html){const fragment=range.createContextualFragment(html);range.deleteContents();range.insertNode(fragment);}
 el('aiAccept').addEventListener('click',()=>{
   if(!aiPending)return;
   if(article.innerHTML!==aiPending.snapshot){el('aiReviewStatus').textContent='Article changed while AI was working. Reject and regenerate to avoid overwriting new edits.';return;}
   try{
     if(['article','outline'].includes(aiPending.task))article.innerHTML=aiPending.html;
     else if(aiPending.range && article.contains(aiPending.range.commonAncestorContainer))insertHtmlAtRange(aiPending.range,aiPending.html);
     else throw Error('Original selection is no longer available.');
     notify();el('aiReviewDialog').close();aiPending=null;
   }catch(e){el('aiReviewStatus').textContent=e.message;}
 });
 // Heading sections: move the heading, all blocks beneath it, and its nested child headings.
 function headingRange(h){
   const start=topBlock(h);if(start!==h)return [];
   const level=Number(h.tagName[1]);let next=h.nextElementSibling;const list=[h];
   while(next){if(/^H[1-6]$/.test(next.tagName)&&Number(next.tagName[1])<=level)break;list.push(next);next=next.nextElementSibling;}
   return list;
 }
 function parentSection(h){
   const lev=Number(h.tagName[1]);let prev=h.previousElementSibling;
   while(prev){if(/^H[1-6]$/.test(prev.tagName) && Number(prev.tagName[1])<lev)return prev;prev=prev.previousElementSibling;}
   return null;
 }
 const moveUndo=[],moveRedo=[];
 function recordMove(){moveUndo.push(article.innerHTML);if(moveUndo.length>20)moveUndo.shift();moveRedo.length=0;}
 function moveHeading(source,target,position){
   if(!source||!target||source===target||source.tagName!==target.tagName)return false;
   if(Number(source.tagName[1])>1 && parentSection(source)!==parentSection(target))return false;
   const segment=headingRange(source), destination=headingRange(target);
   if(segment.length===0||destination.length===0||segment.includes(target))return false;
   const before=position==='before'?destination[0]:destination[destination.length-1].nextElementSibling;
   recordMove();const frag=document.createDocumentFragment();segment.forEach(n=>frag.appendChild(n));article.insertBefore(frag,before||null);notify();return true;
 }
 function moveHeadingOneStep(h,delta){
   const level=h.tagName;const peers=headings().filter(x=>x.tagName===level && x.parentElement===article);
   const index=peers.indexOf(h),next=peers[index+delta];if(next)moveHeading(h,next,delta<0?'before':'after');
 }
 function decorateOutline(){
   const rows=[...el('outline').querySelectorAll('.outline-row')];
   rows.forEach(row=>{
     const level=row.querySelector('.hlabel')?.textContent;
     if(!/^H[1-6]$/.test(level))return;
     const name=row.querySelector('.outline-text')?.textContent;
     const match=headings().find(h=>h.tagName===level && h.textContent.trim()===name);
     if(!match)return;
     row.draggable=true;row.dataset.dragHeading=match.dataset.outlineId||'';row.title='Drag to reorder among headings at the same level';
     const up=document.createElement('button'),down=document.createElement('button');
     up.type=down.type='button';up.className=down.className='outline-move';up.textContent='↑';down.textContent='↓';up.title='Move section up';down.title='Move section down';
     up.setAttribute('aria-label','Move '+name+' up');down.setAttribute('aria-label','Move '+name+' down');
     up.addEventListener('click',e=>{e.stopPropagation();moveHeadingOneStep(match,-1);});
     down.addEventListener('click',e=>{e.stopPropagation();moveHeadingOneStep(match,1);});row.append(up,down);
   });
 }
 document.addEventListener('av:outline-rendered',decorateOutline);decorateOutline();
 el('outline').addEventListener('dragstart',e=>{
   const row=e.target.closest('[data-drag-heading]');if(!row)return;
   dragInfo={kind:'heading',source:headings().find(h=>h.dataset.outlineId===row.dataset.dragHeading)};
   e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','AmpliVerify section');row.classList.add('being-dragged');
 });
 el('outline').addEventListener('dragover',e=>{
   const row=e.target.closest('[data-drag-heading]');if(!row||dragInfo?.kind!=='heading')return;
   const target=headings().find(h=>h.dataset.outlineId===row.dataset.dragHeading);
   if(target?.tagName!==dragInfo.source?.tagName)return;
   e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('drag-over');
 });
 el('outline').addEventListener('dragleave',e=>{const row=e.target.closest('[data-drag-heading]');row?.classList.remove('drag-over');});
 el('outline').addEventListener('drop',e=>{
   const row=e.target.closest('[data-drag-heading]');if(!row||dragInfo?.kind!=='heading')return;
   const target=headings().find(h=>h.dataset.outlineId===row.dataset.dragHeading);
   if(target?.tagName!==dragInfo.source?.tagName)return;
   e.preventDefault();moveHeading(dragInfo.source,target,e.clientY<row.getBoundingClientRect().top+row.offsetHeight/2?'before':'after');dragInfo=null;
 });
 el('outline').addEventListener('dragend',()=>{dragInfo=null;el('outline').querySelectorAll('.being-dragged,.drag-over').forEach(x=>x.classList.remove('being-dragged','drag-over'));});
 // Block dragging uses a dedicated grip, so normal text selection and formatting are unaffected.
 const handle=document.createElement('button');handle.type='button';handle.className='article-drag-handle';handle.textContent='⠿';handle.draggable=true;handle.title='Drag paragraph, list, heading, image, or video';handle.setAttribute('aria-label','Drag content block');
 document.querySelector('.article-scroll').appendChild(handle);
 const scroll=document.querySelector('.article-scroll');
 scroll.addEventListener('mousemove',e=>{
   if(dragInfo)return;
   const block=topBlock(e.target);if(!block||/^H[1-6]$/.test(block.tagName)){handle.hidden=true;return;}
   dragOver=block;const rect=block.getBoundingClientRect(),host=scroll.getBoundingClientRect();
   handle.hidden=false;handle.style.top=(rect.top-host.top+scroll.scrollTop+5)+'px';
 });
 handle.addEventListener('dragstart',e=>{
   if(!dragOver){e.preventDefault();return;}
   dragInfo={kind:'block',source:dragOver};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','AmpliVerify block');dragOver.classList.add('block-moving');
 });
 article.addEventListener('dragover',e=>{
   if(dragInfo?.kind!=='block')return;
   const target=topBlock(e.target);if(!target||target===dragInfo.source)return;
   e.preventDefault();e.dataTransfer.dropEffect='move';article.querySelectorAll('.block-drop-target').forEach(x=>x.classList.remove('block-drop-target'));target.classList.add('block-drop-target');
 });
 article.addEventListener('drop',e=>{
   if(dragInfo?.kind!=='block')return;
   e.preventDefault();const target=topBlock(e.target),source=dragInfo.source;
   if(target&&target!==source){recordMove();const after=e.clientY>target.getBoundingClientRect().top+target.offsetHeight/2;article.insertBefore(source,after?target.nextSibling:target);notify();}
   article.querySelectorAll('.block-drop-target,.block-moving').forEach(x=>x.classList.remove('block-drop-target','block-moving'));dragInfo=null;handle.hidden=true;
 });
 handle.addEventListener('dragend',()=>{article.querySelectorAll('.block-drop-target,.block-moving').forEach(x=>x.classList.remove('block-drop-target','block-moving'));dragInfo=null;});
 article.addEventListener('keydown',e=>{
   if(!(e.altKey&&(e.ctrlKey||e.metaKey)&&['ArrowUp','ArrowDown'].includes(e.key)))return;
   const block=topBlock(window.getSelection()?.anchorNode);if(!block)return;
   const sibling=e.key==='ArrowUp'?block.previousElementSibling:block.nextElementSibling;if(!sibling)return;
   e.preventDefault();recordMove();article.insertBefore(block,e.key==='ArrowUp'?sibling:sibling.nextElementSibling);notify();
 });
 document.addEventListener('av:record-form-move',recordMove);
 // Undo/redo for DOM moves (separate from browser text-formatting undo).
 const undoBtn=document.createElement('button'),redoBtn=document.createElement('button');
 undoBtn.type=redoBtn.type='button';undoBtn.className=redoBtn.className='move-history-btn';
 undoBtn.textContent='↶ Undo move';redoBtn.textContent='↷ Redo move';
 const historyWrap=document.createElement('div');historyWrap.className='move-history';historyWrap.append(undoBtn,redoBtn);
 el('outline').after(historyWrap);
 undoBtn.onclick=()=>{if(!moveUndo.length)return;moveRedo.push(article.innerHTML);article.innerHTML=moveUndo.pop();notify();};
 redoBtn.onclick=()=>{if(!moveRedo.length)return;moveUndo.push(article.innerHTML);article.innerHTML=moveRedo.pop();notify();};
 // Local drag-and-drop images: reuse the same small-file data URI strategy as the existing upload control.
 article.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();el('dropHint').hidden=false;} });
 article.addEventListener('dragleave',e=>{if(!article.contains(e.relatedTarget))el('dropHint').hidden=true;});
 article.addEventListener('drop',async e=>{
   el('dropHint').hidden=true;const files=[...(e.dataTransfer?.files||[])];if(!files.length)return;
   e.preventDefault();const file=files[0];if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>900000){alert('Choose a PNG/JPEG/WebP/GIF image under 900 KB.');return;}
   const reader=new FileReader();reader.onload=()=>{const figure=document.createElement('figure');figure.className='media-block';figure.contentEditable='false';const remove=document.createElement('button');remove.className='remove-media';remove.type='button';remove.textContent='✕ Remove';const img=document.createElement('img');img.src=reader.result;img.alt='Inserted image';const caption=document.createElement('figcaption');caption.textContent='Image caption';figure.append(remove,img,caption);article.appendChild(figure);notify();};reader.readAsDataURL(file);
 });
})();
