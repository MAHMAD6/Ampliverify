/* V8 Form Builder extension. Backend required to create shareable and working forms. */
(() => {
'use strict';
const $=id=>document.getElementById(id), article=$('article');
const d=$('formBuilderDialog'), fieldRoot=$('fbFields'), status=$('fbStatus'), preview=$('fbPreview');
let fields=[], next=0, lastRange=null, editingFormId=null, pendingDrop=null;
const themeDefaults={mode:'neutral',background:'#ffffff',text:'#243144',border:'#d4dbe4',button:'#233b55',buttonText:'#ffffff',accent:'#2563a6',font:'inherit',fontSize:14,spacing:12,radius:8,width:100,height:0};
const styleIds={mode:'fbTheme',background:'fbBg',text:'fbTextColor',border:'fbBorderColor',button:'fbButtonColor',buttonText:'fbButtonText',accent:'fbAccent',font:'fbFont',fontSize:'fbFontSize',spacing:'fbSpacing',radius:'fbRadius',width:'fbWidth',height:'fbHeight'};
function readStyle(){const v={};for(const [k,id] of Object.entries(styleIds))v[k]=$(id)?.value;return cleanStyle(v);}
function cleanStyle(v){v=v&&typeof v==='object'?v:{};const c={...themeDefaults};c.mode=['neutral','inherit','custom'].includes(v.mode)?v.mode:'neutral';for(const k of ['background','text','border','button','buttonText','accent'])if(/^#[0-9a-f]{6}$/i.test(String(v[k]||'')))c[k]=v[k];c.font=['inherit','Arial, sans-serif','Georgia, serif','Verdana, sans-serif','Tahoma, sans-serif'].includes(v.font)?v.font:'inherit';for(const [k,min,max] of [['fontSize',12,24],['spacing',4,32],['radius',0,32],['width',30,100],['height',0,1200]]){const n=Number(v[k]);if(Number.isFinite(n))c[k]=Math.round(Math.max(min,Math.min(max,n)));}return c;}
function loadStyle(v){const s=cleanStyle(v);for(const [k,id] of Object.entries(styleIds))if($(id))$(id).value=String(s[k]);setStyleEnabled();}
function setStyleEnabled(){const isInherit=$('fbTheme').value==='inherit';for(const k of ['background','text','border','button','buttonText','accent'])$(styleIds[k]).disabled=isInherit;}
function applyFormStyle(node,form){const s=cleanStyle(form.style);node.dataset.avTheme=s.mode;const vars={background:s.background,text:s.text,border:s.border,button:s.button,buttonText:s.buttonText,accent:s.accent};for(const [k,v] of Object.entries(vars))node.style.setProperty('--avf-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),v);node.style.setProperty('--avf-font',s.font);node.style.setProperty('--avf-font-size',s.fontSize+'px');node.style.setProperty('--avf-spacing',s.spacing+'px');node.style.setProperty('--avf-radius',s.radius+'px');return s;}

const templates={
 contact:{name:'Contact Us',description:'Send us a message.',fields:[['name','Full Name','text',true],['email','Email Address','email',true],['message','Message','textarea',true]]},
 lead:{name:'Request More Information',description:'Tell us how we can help.',fields:[['name','Full Name','text',true],['email','Business Email','email',true],['company','Company','text',false]]},
 newsletter:{name:'Newsletter Signup',description:'Get helpful updates in your inbox.',fields:[['email','Email Address','email',true]]},
 survey:{name:'Your Feedback',description:'We value your opinion.',fields:[['name','Your Name','text',false],['rating','Overall Experience','select',true],['feedback','Comments','textarea',false]]},
 custom:{name:'Custom Form',description:'Please complete the fields below.',fields:[['name','Your Name','text',false]]}
};
function field(key,label,kind,required){return {key:key+'_'+(++next),label,kind,required,options:kind==='select'?['Excellent','Good','Needs improvement']:[]};}
function loadTemplate(k){const x=templates[k];next=0;fields=x.fields.map(a=>field(...a));$('fbName').value=x.name;$('fbDescription').value=x.description;$('fbSubmitLabel').value='Submit';$('fbSuccess').value='Thank you! Your response was received.';loadStyle(themeDefaults);render();}
function button(label,handler,title){const b=document.createElement('button');b.type='button';b.textContent=label;if(title)b.title=title;b.addEventListener('click',handler);return b;}
function updateStatus(msg,error=false){status.textContent=msg;status.className=error?'fb-error':'fb-success';}
function render(){fieldRoot.replaceChildren();fields.forEach((f,i)=>{
 const row=document.createElement('div');row.className='form-field-editor';row.draggable=true;row.dataset.key=f.key;
 const top=document.createElement('div');const drag=document.createElement('span');drag.className='fb-drag';drag.textContent='⠿';drag.title='Drag to reorder';top.append(drag);
 const label=document.createElement('input');label.type='text';label.maxLength=100;label.value=f.label;label.setAttribute('aria-label','Field label');label.addEventListener('input',()=>{f.label=label.value;renderPreview();});top.append(label);
 const kind=document.createElement('select');['text','email','tel','textarea','select','checkbox'].forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;kind.append(o);});kind.value=f.kind;kind.addEventListener('change',()=>{f.kind=kind.value;if(f.kind==='select'&&!f.options.length)f.options=['Option A','Option B'];render();});top.append(kind);row.append(top);
 const bottom=document.createElement('div');bottom.className='fb-row';const required=document.createElement('label');required.style.fontSize='12px';required.style.display='inline-flex';required.style.gap='4px';required.style.alignItems='center';const check=document.createElement('input');check.type='checkbox';check.checked=f.required;check.addEventListener('change',()=>{f.required=check.checked;renderPreview();});required.append(check,document.createTextNode('Required'));bottom.append(required);
 bottom.append(button('↑',()=>move(i,-1),'Move up'),button('↓',()=>move(i,1),'Move down'),button('Remove',()=>{fields.splice(i,1);render();}));row.append(bottom);
 if(f.kind==='select'){const opts=document.createElement('input');opts.className='fb-control';opts.style.marginTop='7px';opts.value=f.options.join(', ');opts.placeholder='Options separated by commas';opts.setAttribute('aria-label','Dropdown options');opts.addEventListener('input',()=>{f.options=opts.value.split(',').map(x=>x.trim()).filter(Boolean);renderPreview();});row.append(opts);}
 row.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',f.key);e.dataTransfer.effectAllowed='move';});row.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});row.addEventListener('drop',e=>{e.preventDefault();const key=e.dataTransfer.getData('text/plain');const from=fields.findIndex(x=>x.key===key),to=fields.findIndex(x=>x.key===f.key);if(from>=0&&to>=0&&from!==to){fields.splice(to,0,fields.splice(from,1)[0]);render();}});
 fieldRoot.append(row);
 });renderPreview();}
 function move(i,offset){const to=i+offset;if(to<0||to>=fields.length)return;fields.splice(to,0,fields.splice(i,1)[0]);render();}
 function renderPreview(){preview.replaceChildren();applyFormStyle(preview,{style:readStyle()});const title=document.createElement('h3');title.textContent=$('fbName').value||'Untitled form';preview.append(title);const desc=document.createElement('p');desc.className='fb-note';desc.textContent=$('fbDescription').value;preview.append(desc);
 fields.forEach(f=>{const label=document.createElement('label');label.textContent=(f.label||'Untitled field')+(f.required?' *':'');preview.append(label);let input;if(f.kind==='textarea')input=document.createElement('textarea');else if(f.kind==='select'){input=document.createElement('select');const opt=document.createElement('option');opt.textContent='Choose…';input.append(opt);f.options.forEach(t=>{const o=document.createElement('option');o.textContent=t;input.append(o);});}else{input=document.createElement('input');input.type=f.kind;}input.disabled=true;preview.append(input);});
 if($('fbConsent').checked){const lab=document.createElement('p');lab.className='fb-note';lab.textContent='☐ Consent required before submission';preview.append(lab);}
 const submit=document.createElement('button');submit.type='button';submit.disabled=true;submit.textContent=$('fbSubmitLabel').value||'Submit';preview.append(submit);
 }
 // Opening and saving are provided by the V11 offline-first form workflow below.
 
 // Preserve the existing Insert Section tab, substituting only its action.
 
 
 
 
 function config(){const url=($('backendUrl')?.value||'http://127.0.0.1:3000').replace(/\/$/,'');const workspace=$('workspaceId')?.value?.trim(),jwt=globalThis.AMPLIVERIFY_TOKEN?.() || $('backendKey')?.value?.trim();if(!workspace||!jwt)throw Error('Connect your backend first: Connections → workspace and bearer token.');if(!/^https:\/\//.test(url)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))throw Error('The backend must use HTTPS outside localhost.');return {url,workspace,jwt};}
 function schema(){return {name:$('fbName').value.trim(),description:$('fbDescription').value.trim(),submit_label:$('fbSubmitLabel').value.trim(),success_message:$('fbSuccess').value.trim(),privacy_url:$('fbPrivacy').value.trim()||null,consent_required:$('fbConsent').checked,style:readStyle(),fields:fields.map(f=>({key:f.key,label:f.label.trim(),kind:f.kind,required:f.required,options:f.kind==='select'?f.options:[]}))};}
 // V11: offline-first form definitions. Inserting and editing never contacts the API.
 const LOCAL_KEY='ampliverify:local-form-library:v11';
 let editingBlock=null;
 function getLibrary(){try{const v=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
 function putLibrary(id,form){try{const all=getLibrary().filter(x=>x.id!==id);all.unshift({id,schema:form});localStorage.setItem(LOCAL_KEY,JSON.stringify(all.slice(0,50)));}catch{updateStatus('Inserted in this article; local template library could not be saved.',true);}}
 function safeSchema(value){
  if(!value||typeof value!=='object')throw Error('Invalid saved form.');
  const clean=s=>String(s??'').slice(0,500);
  const out={name:clean(value.name).slice(0,120),description:clean(value.description),submit_label:clean(value.submit_label||'Submit').slice(0,40),success_message:clean(value.success_message||'Thank you.').slice(0,160),privacy_url:clean(value.privacy_url||''),consent_required:!!value.consent_required,style:cleanStyle(value.style),fields:[]};
  const used=new Set();
  for(const f of (Array.isArray(value.fields)?value.fields:[]).slice(0,20)){
   let key=String(f.key||'').slice(0,40).toLowerCase();if(!/^[a-z][a-z0-9_]{0,39}$/.test(key)||used.has(key))key='field_'+(++next);
   if(used.has(key))continue;used.add(key);
   const kind=['text','email','tel','textarea','select','checkbox'].includes(f.kind)?f.kind:'text';
   out.fields.push({key,label:clean(f.label).slice(0,100),kind,required:!!f.required,options:kind==='select'?(Array.isArray(f.options)?f.options:[]).slice(0,20).map(x=>clean(x).slice(0,100)):[]});
  }
  if(!out.name.trim()||!out.fields.length)throw Error('Give the form a title and at least one field.');
  return out;
 }
 const decode=box=>{try{return safeSchema(JSON.parse(decodeURIComponent(box.dataset.formSchema||'')));}catch{return null;}};
 function el(tag,cls,content){const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;}
 function applyInlineStyles(body,form){const s=cleanStyle(form.style);if(s.mode==='inherit')return;
  Object.assign(body.style,{backgroundColor:s.background,color:s.text,borderColor:s.border,borderRadius:s.radius+'px',fontFamily:s.font,fontSize:s.fontSize+'px'});
  body.querySelectorAll('.av-form-heading,.av-form-description,.av-inline-field').forEach(el=>{el.style.color=s.text;el.style.fontFamily=s.font;});
  body.querySelectorAll('input,textarea,select').forEach(el=>Object.assign(el.style,{backgroundColor:s.background,color:s.text,borderColor:s.border,borderRadius:s.radius+'px',fontFamily:s.font}));
  const btn=body.querySelector('.av-fake-submit');if(btn)Object.assign(btn.style,{backgroundColor:s.button,color:s.buttonText,borderRadius:s.radius+'px'});
 }
 function mockup(block,form){
  applyFormStyle(block,form);
  block.querySelector('.av-form-body')?.remove();
  const body=el('div','av-form-body');body.append(el('strong','av-form-heading','▦ '+form.name));
  if(form.description)body.append(el('p','av-form-description',form.description));
  for(const f of form.fields){
   const label=el('label','av-inline-field',f.label+(f.required?' *':''));let input;
   if(f.kind==='textarea')input=document.createElement('textarea');
   else if(f.kind==='select'){input=document.createElement('select');input.append(el('option','', 'Choose…'));for(const item of f.options)input.append(el('option','',item));}
   else {input=document.createElement('input');input.type=f.kind;}input.disabled=true;input.setAttribute('aria-label',f.label);label.append(input);body.append(label);
  }
  if(form.consent_required)body.append(el('p','fb-note','☐ Consent required before submitting'));
  const send=el('button','av-fake-submit',form.submit_label||'Submit');send.type='button';send.disabled=true;body.append(send);
  const hint=el('p','av-form-offline-note','Design preview only · Submissions disabled until form activation');body.append(hint);
  block.append(body);applyInlineStyles(body,form);
 }
 function display(block){
  const form=decode(block);if(!form)return;applyFormStyle(block,form);
  const hosted=block.dataset.formStatus==='active' && (/^https:\/\//.test(block.dataset.formUrl||'') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(block.dataset.formUrl||''));
  block.querySelectorAll('.av-form-body,.av-form-hosted').forEach(x=>x.remove());
  if(hosted){
   const body=el('div','av-form-hosted');body.append(el('p','av-form-heading','▦ '+form.name+' · Hosted form'));
   const iframe=document.createElement('iframe');iframe.src=block.dataset.formUrl;iframe.title=form.name;iframe.loading='lazy';iframe.setAttribute('sandbox','allow-forms allow-scripts');iframe.referrerPolicy='no-referrer';body.append(iframe);
   const link=el('a','', 'Open hosted form');link.href=block.dataset.formUrl;link.target='_blank';link.rel='noopener noreferrer';body.append(link);block.append(body);
  }else mockup(block,form);
  const act=block.querySelector('.av-form-activate');if(act)act.textContent=hosted?'✓ Active':'Activate';
 }
 function notify(){article.dispatchEvent(new Event('input',{bubbles:true}));}
 function addToArticle(formInput,origin){
  const form=safeSchema(formInput.schema||formInput);
  const id=formInput.id||((globalThis.crypto?.randomUUID?.())||('local-'+Date.now()+'-'+Math.random().toString(16).slice(2)));
  const box=document.createElement('div');box.className='av-form-block';box.contentEditable='false';box.dataset.formId=id;box.dataset.formStatus='draft';box.dataset.formSchema=encodeURIComponent(JSON.stringify(form));box.dataset.v11Form='1';
  box.style.width=form.style.width+'%';box.dataset.formWidth=String(form.style.width);box.dataset.formHeight=String(form.style.height);if(form.style.height)box.style.height=form.style.height+'px';
  let placed=false;
  if(pendingDrop?.parentElement===article){article.insertBefore(box,pendingDrop);pendingDrop.remove();placed=true;}
  pendingDrop=null;
  if(!placed&&lastRange&&article.contains(lastRange.commonAncestorContainer)){
   try{let n=lastRange.startContainer.nodeType===1?lastRange.startContainer:lastRange.startContainer.parentElement;while(n&&n.parentElement!==article)n=n.parentElement;if(n&&n.parentElement===article){n.after(box);placed=true;}}catch{}
  }
  if(!placed)article.append(box);
  window.AVFormDnD?.decorate(box);display(box);putLibrary(id,form);notify();box.scrollIntoView({block:'nearest'});
  return box;
 }
 function hydrateFromMarkup(){
  article.querySelectorAll('.av-form-block').forEach(box=>{
   const form=decode(box);
   if(!form)return;
   box.querySelector('.av-form-tools')?.remove(); // Drop stale inline handlers after restoring drafts.
   box.querySelectorAll('iframe,a,.av-form-heading,.av-form-body,.av-form-hosted').forEach(x=>{if(!x.closest('.av-form-tools'))x.remove();});
   box.dataset.v11Form='1';window.AVFormDnD?.decorate(box);display(box);
  });
 }
 function editExisting(box){
  const form=decode(box);if(!form)return updateStatus('This legacy form has no local schema; insert a new template.',true);
  form.style.width=Number(box.dataset.formWidth)||form.style.width;form.style.height=Number(box.dataset.formHeight)||0;
  editingBlock=box;editingFormId=null;next=0;fields=form.fields.map(x=>({...x,options:[...(x.options||[])]}));next=fields.length+1;
  $('fbName').value=form.name;$('fbDescription').value=form.description;$('fbSubmitLabel').value=form.submit_label;$('fbSuccess').value=form.success_message;$('fbPrivacy').value=form.privacy_url;$('fbConsent').checked=!!form.consent_required;loadStyle(form.style);
  $('fbSave').textContent='Save Form Locally';render();updateStatus('Edit offline. If previously activated, edits require reactivation before the hosted form changes.');d.showModal();
 }
 function openLocal(template='contact'){
  editingBlock=null;editingFormId=null;const sel=window.getSelection();if(sel?.rangeCount&&article.contains(sel.anchorNode))lastRange=sel.getRangeAt(0).cloneRange();
  $('fbTemplate').value=templates[template]?template:'contact';loadTemplate($('fbTemplate').value);
  $('fbSave').textContent='Insert Form (Offline)';updateStatus('Design mode: no backend or credentials required.');d.showModal();
 }
 function connectedConfig(){
  const url=($('backendUrl')?.value||'').trim().replace(/\/$/,'');const workspace=$('workspaceId')?.value?.trim();
  const jwt=globalThis.AMPLIVERIFY_ACCESS_TOKEN||$('backendKey')?.value?.trim();
  if(!workspace||!jwt)throw Error('To activate, connect your workspace and sign in under Connections. Local editing needs no backend.');
  if(!/^https:\/\//.test(url)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))throw Error('Backend must use HTTPS outside localhost.');
  return {url,workspace,jwt};
 }
 async function activate(block){
  const form=decode(block);if(!form)throw Error('Invalid form schema.');
  const cfg=connectedConfig();
  // Deliberately create an immutable new form instance; never overwrite existing submissions.
  // Hosted changes are opt-in via Activate, not a side effect of editing.
  const r=await fetch(`${cfg.url}/api/workspaces/${encodeURIComponent(cfg.workspace)}/forms`,{method:'POST',headers:{Authorization:'Bearer '+cfg.jwt,'Content-Type':'application/json'},body:JSON.stringify({...form,previous_form_id:block.dataset.formId})});
  const saved=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof saved.detail==='string'?saved.detail:'Form activation failed');
  const link=new URL(saved.public_path,cfg.url);
  block.dataset.formId=saved.id;block.dataset.formUrl=link.href;block.dataset.formStatus='active';display(block);notify();return saved;
 }
 // The form palette remains draggable; V10 drag-and-drop controls still handle placement/movement.
 window.AVForms={openBuilder:openLocal,editExisting,addToArticle,setDropTarget(node){pendingDrop=node;},hydrateFromMarkup,activate,decode,get editingFormId(){return editingFormId;}};
 $('fbOpenBtn').onclick=()=>openLocal('contact');
 const insertTab=document.querySelector('[data-editor-tab="insert"]');insertTab.addEventListener('click',e=>{e.stopImmediatePropagation();window.AVFormDnD?.togglePalette(insertTab);},true);
 $('fbCancel').onclick=()=>d.close();$('fbTemplate').onchange=e=>loadTemplate(e.target.value);
 $('fbAddField').onclick=()=>{if(fields.length>=20)return updateStatus('Maximum 20 fields.',true);fields.push(field('field','New field','text',false));render();};
 ['fbName','fbDescription','fbSubmitLabel','fbConsent'].forEach(id=>$(id).addEventListener('input',renderPreview));
 Object.values(styleIds).forEach(id=>$(id).addEventListener('input',()=>{setStyleEnabled();renderPreview();}));
 $('fbLoadSaved').onclick=()=>{const root=$('fbSavedList');root.replaceChildren();const items=getLibrary();if(!items.length){root.textContent='No local form templates yet. Build a form and insert it to save it here.';return;}
  items.forEach(item=>{const row=el('div','fb-row');row.style.padding='7px 0';const title=el('span','',item.schema.name);title.style.flex='1';const btn=button('Insert copy',()=>{editingBlock=null;addToArticle({schema:item.schema});d.close();});row.append(title,btn);root.append(row);});
 };
 $('fbSave').onclick=()=>{
  try{const form=safeSchema(schema());if(editingBlock){editingBlock.dataset.formSchema=encodeURIComponent(JSON.stringify(form));editingBlock.style.width=form.style.width+'%';editingBlock.style.height=form.style.height?form.style.height+'px':'';editingBlock.dataset.formWidth=String(form.style.width);editingBlock.dataset.formHeight=String(form.style.height);editingBlock.dataset.formStatus='draft';editingBlock.removeAttribute('data-form-url');display(editingBlock);putLibrary(editingBlock.dataset.formId,form);notify();}
   else addToArticle(form);
   d.close();
  }catch(e){updateStatus(e.message||'Could not save form locally.',true);}
 };
 // Rehydrate after browser local drafts / undo / AI replacements.
 hydrateFromMarkup();
 document.addEventListener('av:forms-restored',hydrateFromMarkup);
 document.getElementById('historyDialog')?.addEventListener('close',()=>setTimeout(hydrateFromMarkup,0));
 // Delegate activation: works even after undo/redo or restored drafts.
 article.addEventListener('click',async e=>{
  const b=e.target.closest('.av-form-activate');if(!b)return;
  const box=b.closest('.av-form-block');if(!box)return;
  if(box.dataset.formStatus==='active')return;
  b.disabled=true;b.textContent='Activating…';try{await activate(box);alert('Form activated. It can now receive submissions at its hosted URL.');}catch(err){alert(err.message||'Activation failed.');}finally{b.disabled=false;display(box);}
 });
})();
