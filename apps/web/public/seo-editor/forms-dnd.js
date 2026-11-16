/* V10 Form block controls. Additive: reuses V9 hosted form service and the existing editor. */
(() => {
'use strict';
const article=document.getElementById('article'), tab=document.querySelector('[data-editor-tab="insert"]');
const palette=document.createElement('div');palette.id='avFormPalette';palette.className='av-form-palette';palette.hidden=true;
palette.setAttribute('role','group');palette.setAttribute('aria-label','Drag a form into your article');
palette.innerHTML='<div class="av-palette-heading"><strong>Insert Form</strong><button type="button" data-close aria-label="Close form palette">✕</button></div><p>Drag a template to a position in the article, or click to insert at the cursor.</p>';
const presets=[['contact','Contact form'],['lead','Lead generation'],['newsletter','Newsletter'],['survey','Survey / feedback'],['custom','Custom form']];
for(const [key,label] of presets){const item=document.createElement('button');item.type='button';item.draggable=true;item.className='av-form-palette-item';item.dataset.formTemplate=key;item.textContent='⠿  '+label;item.title='Drag into article or click to insert';item.addEventListener('click',()=>{clearDrop();palette.hidden=true;window.AVForms?.openBuilder(key);});item.addEventListener('dragstart',e=>{e.dataTransfer.setData('application/x-av-form-template',key);e.dataTransfer.setData('text/plain','av-form-template:'+key);e.dataTransfer.effectAllowed='copy';});palette.append(item);}
const openBuilder=document.createElement('button');openBuilder.type='button';openBuilder.textContent='＋ Open full Form Builder';openBuilder.className='av-form-palette-builder';openBuilder.onclick=()=>{palette.hidden=true;clearDrop();window.AVForms?.openBuilder('custom');};palette.append(openBuilder);
document.body.append(palette);palette.querySelector('[data-close]').onclick=()=>palette.hidden=true;
function togglePalette(anchor){palette.hidden=!palette.hidden;if(!palette.hidden){const r=anchor.getBoundingClientRect();palette.style.top=Math.min(innerHeight-360,r.bottom+5)+'px';palette.style.left=Math.min(innerWidth-260,r.left)+'px';}}
let dragging=null, hover=null;
const topBlock=node=>{let n=node?.nodeType===1?node:node?.parentElement;while(n&&n.parentElement!==article)n=n.parentElement;return n?.parentElement===article?n:null;};
const currentTemplate=e=>e.dataTransfer?.getData('application/x-av-form-template') || (e.dataTransfer?.getData('text/plain')||'').replace(/^av-form-template:/,'');
function clearDrop(){article.querySelectorAll('.av-form-drop-before,.av-form-drop-after,.av-form-moving').forEach(el=>el.classList.remove('av-form-drop-before','av-form-drop-after','av-form-moving'));hover=null;}
function mark(target,clientY){clearDrop();if(!target||target===dragging?.block)return;const r=target.getBoundingClientRect();const after=clientY>r.top+r.height/2;target.classList.add(after?'av-form-drop-after':'av-form-drop-before');hover={target,after};}
function notify(){article.dispatchEvent(new Event('input',{bubbles:true}));}
function snapshot(){document.dispatchEvent(new Event('av:record-form-move'));}
function moveForm(box,target,after){if(!box||!target||box===target)return; if(target.closest('.av-form-block')===box)return; snapshot();article.insertBefore(box,after?target.nextSibling:target);notify();box.scrollIntoView({block:'nearest'});}
// Drag only from the form's dedicated handle so the iframe remains usable.
article.addEventListener('dragstart',e=>{const grip=e.target.closest('.av-form-grip');if(!grip)return;const box=grip.closest('.av-form-block');if(!box)return;dragging={kind:'existing',block:box};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-av-form-block',box.dataset.formId||'form');e.dataTransfer.setData('text/plain','av-existing-form');box.classList.add('av-form-moving');},true);
article.addEventListener('dragover',e=>{const external=e.dataTransfer?.types?.includes('application/x-av-form-template');if(!dragging && !external)return;let target=topBlock(e.target);if(target===dragging?.block)return;e.preventDefault();e.stopImmediatePropagation();e.dataTransfer.dropEffect=dragging?'move':'copy';if(target)mark(target,e.clientY);else clearDrop();},true);
article.addEventListener('drop',e=>{const external=e.dataTransfer?.types?.includes('application/x-av-form-template');if(!dragging && !external)return;e.preventDefault();e.stopImmediatePropagation();const target=hover?.target || topBlock(e.target),after=hover?.after??false;
 if(dragging){moveForm(dragging.block,target,after);dragging=null;clearDrop();return;}
 const template=currentTemplate(e);clearDrop();if(!presets.some(x=>x[0]===template))return;
 // The real form is inserted only after save succeeds. No fake live submissions.
 const marker=document.createElement('span');marker.className='av-form-insert-marker';marker.textContent='Form insertion position';marker.contentEditable='false';
 if(target)article.insertBefore(marker,after?target.nextSibling:target);else article.append(marker);
 window.AVForms?.setDropTarget(marker);palette.hidden=true;window.AVForms?.openBuilder(template);
},true);
article.addEventListener('dragend',()=>{dragging=null;clearDrop();},true);
// Clean up an uncommitted insertion marker when a user dismisses the builder.
const dialog=document.getElementById('formBuilderDialog');dialog.addEventListener('close',()=>{article.querySelectorAll('.av-form-insert-marker').forEach(x=>x.remove());window.AVForms?.setDropTarget(null);});
// Keyboard equivalent: Alt+Shift+Up/Down on a focused form move handle.
article.addEventListener('keydown',e=>{if(!(e.altKey && e.shiftKey && ['ArrowUp','ArrowDown'].includes(e.key)))return;const grip=e.target.closest('.av-form-grip');if(!grip)return;const box=grip.closest('.av-form-block'),target=e.key==='ArrowUp'?box.previousElementSibling:box.nextElementSibling;if(!target)return;e.preventDefault();e.stopImmediatePropagation();moveForm(box,target,e.key==='ArrowDown');},true);
// Restored drafts from old V9 may lack the control strip. Add it without touching the hosted form.
function decorate(box){if(box.querySelector('.av-form-tools')){ensureDimensions(box);if(!box.querySelector('.av-form-activate')){const b=document.createElement('button');b.type='button';b.className='av-form-activate';b.textContent=box.dataset.formStatus==='active'?'✓ Active':'Activate';box.querySelector('.av-form-tools').insertBefore(b,box.querySelector('.av-form-remove')||null);}return;}const toolbar=document.createElement('div');toolbar.className='av-form-tools';toolbar.contentEditable='false';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Form block controls');
 const grip=document.createElement('div');grip.setAttribute('role','button');grip.tabIndex=0;grip.draggable=true;grip.className='av-form-grip';grip.textContent='⠿ Move';grip.title='Drag to reposition form; Alt+Shift+Arrows to move with keyboard';
 const edit=document.createElement('button');edit.type='button';edit.className='av-form-edit';edit.textContent='✎ Edit';
 const sizes=document.createElement('input');sizes.type='number';sizes.min='30';sizes.max='100';sizes.step='1';sizes.setAttribute('aria-label','Form width percent');sizes.className='av-form-width';sizes.title='Width in percent of article';sizes.value=parseInt(box.dataset.formWidth||box.style.width||'100',10)||100;const height=document.createElement('input');height.type='number';height.min='0';height.max='1200';height.step='10';height.setAttribute('aria-label','Form height in pixels (0 for automatic)');height.className='av-form-height';height.title='Height in pixels; 0 = auto';height.value=parseInt(box.dataset.formHeight||'0',10)||0;
 const activate=document.createElement('button');activate.type='button';activate.className='av-form-activate';activate.textContent=box.dataset.formStatus==='active'?'✓ Active':'Activate';
 const remove=document.createElement('button');remove.type='button';remove.className='av-form-remove';remove.textContent='✕ Remove';
 const widthLabel=document.createElement('label');widthLabel.className='av-form-dimension-label';widthLabel.textContent='W %';widthLabel.append(sizes);const heightLabel=document.createElement('label');heightLabel.className='av-form-dimension-label';heightLabel.textContent='H px';heightLabel.append(height);toolbar.append(grip,edit,widthLabel,heightLabel,activate,remove);box.prepend(toolbar);}
function ensureDimensions(box){const tools=box.querySelector('.av-form-tools');if(!tools)return;
 if(!tools.querySelector('.av-form-height')){const w=tools.querySelector('.av-form-width');if(w){const parent=w.parentElement;if(w.tagName==='SELECT'){const n=document.createElement('input');n.type='number';n.min='30';n.max='100';n.className='av-form-width';n.setAttribute('aria-label','Form width percent');n.value=parseInt(box.dataset.formWidth||box.style.width||'100',10)||100;w.replaceWith(n);} }const h=document.createElement('input');h.type='number';h.min='0';h.max='1200';h.step='10';h.className='av-form-height';h.setAttribute('aria-label','Form height in pixels (0 = automatic)');h.value=parseInt(box.dataset.formHeight||'0',10)||0;const label=document.createElement('label');label.className='av-form-dimension-label';label.textContent='H px';label.append(h);tools.insertBefore(label,tools.querySelector('.av-form-activate'));}
 const w=tools.querySelector('.av-form-width');if(w&&w.tagName==='INPUT')w.value=parseInt(box.dataset.formWidth||box.style.width||'100',10)||100;
 const h=tools.querySelector('.av-form-height');if(h)h.value=parseInt(box.dataset.formHeight||'0',10)||0;
}
// Normalize the newly-created controls too: the V8 builder already adds these.
function refresh(){article.querySelectorAll('.av-form-block').forEach(decorate);}
refresh();document.addEventListener('av:forms-restored',refresh);document.getElementById('historyDialog').addEventListener('close',refresh);
const observer=new MutationObserver(()=>{if(article.querySelector('.av-form-block:not([data-v10-decorated])')){article.querySelectorAll('.av-form-block:not([data-v10-decorated])').forEach(x=>{decorate(x);x.dataset.v10Decorated='1';});}});
observer.observe(article,{childList:true,subtree:false});article.querySelectorAll('.av-form-block').forEach(x=>x.dataset.v10Decorated='1');
document.addEventListener('click',e=>{if(!palette.hidden && !palette.contains(e.target) && e.target!==tab)palette.hidden=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')palette.hidden=true;});

article.addEventListener('click',e=>{
 const t=e.target.closest('.av-form-edit,.av-form-remove');if(!t)return;
 const box=t.closest('.av-form-block');if(!box)return;
 if(t.classList.contains('av-form-edit'))window.AVForms?.editExisting(box);
 else if(confirm('Remove the form block from the article? Existing hosted submissions will not be deleted.')){snapshot();box.remove();notify();}
});
article.addEventListener('change',e=>{const t=e.target.closest('.av-form-width,.av-form-height');if(!t)return;const box=t.closest('.av-form-block');if(!box)return;
 if(t.classList.contains('av-form-width')){const width=Math.max(30,Math.min(100,Math.round(Number(t.value)||100)));box.style.width=width+'%';box.dataset.formWidth=String(width);t.value=width;}
 else{const height=Math.max(0,Math.min(1200,Math.round(Number(t.value)||0)));box.style.height=height?height+'px':'';box.dataset.formHeight=String(height);t.value=height;}
 try{const v=JSON.parse(decodeURIComponent(box.dataset.formSchema||''));if(v.style){v.style.width=Number(box.dataset.formWidth)||100;v.style.height=Number(box.dataset.formHeight)||0;box.dataset.formSchema=encodeURIComponent(JSON.stringify(v));}}catch{}
 notify();});
// Native CSS resize handles change inline styles; capture the new dimensions on pointer release.
let resizeBefore=null;
article.addEventListener('pointerdown',e=>{const box=e.target.closest('.av-form-block');resizeBefore=box?{box,width:box.style.width,height:box.style.height}:null;},true);
document.addEventListener('pointerup',()=>{if(!resizeBefore)return;const {box,width,height}=resizeBefore;resizeBefore=null;if(!box.isConnected)return;if(box.style.width!==width||box.style.height!==height){
  const wp=box.style.width.match(/^([\d.]+)px$/);if(wp&&article.clientWidth){const percent=Math.max(30,Math.min(100,Math.round(Number(wp[1])/article.clientWidth*100)));box.dataset.formWidth=String(percent);}else if(box.style.width.endsWith('%'))box.dataset.formWidth=String(parseInt(box.style.width,10));
  const hp=box.style.height.match(/^([\d.]+)px$/);if(hp)box.dataset.formHeight=String(Math.max(0,Math.min(1200,Math.round(Number(hp[1])))));
  try{const v=JSON.parse(decodeURIComponent(box.dataset.formSchema||''));if(v.style){v.style.width=Number(box.dataset.formWidth)||100;v.style.height=Number(box.dataset.formHeight)||0;box.dataset.formSchema=encodeURIComponent(JSON.stringify(v));}}catch{}
  ensureDimensions(box);notify();
 }});
window.AVFormDnD={togglePalette,decorate};
})();
