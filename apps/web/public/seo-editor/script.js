(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const article = $('article');
  const draftKey = 'ampliverify-seo-editor-demo-v1';
  const revisionsKey = 'ampliverify-seo-editor-demo-history-v1';
  const collapsed = new Set();
  let outlineInitialised = false;
  let dirty = false;
  let savedSelection = null;
  const getHeadings = () => [...article.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const text = (node) => (node?.textContent || '').trim();
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const toast = (s) => { const el = $('toast'); el.textContent=s; el.hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>{el.hidden=true},3300); };
  const headingAncestor = (node) => { let n = node?.nodeType===1 ? node : node?.parentElement; while(n && n!==article){if(/^H[1-6]$/.test(n.tagName) || n.tagName==='P')return n; n=n.parentElement;}return null;};
  function saveSelection(){const s=window.getSelection();if(s && s.rangeCount && article.contains(s.anchorNode))savedSelection=s.getRangeAt(0).cloneRange();}
  function restoreSelection(){if(savedSelection){const s=window.getSelection();s.removeAllRanges();s.addRange(savedSelection);}}
  function markDirty(){dirty=true;$('saveStatus').innerHTML='● <span>Unsaved changes</span>';$('saveStatus').style.color='#ae6900'; updateAll();}
  function saveDraft(showToast=false){try {localStorage.setItem(draftKey, JSON.stringify({html:article.innerHTML,title:$('metaTitle').value,description:$('metaDescription').value,keyword:$('primaryKeyword').value,alt:$('altText').value,updated:new Date().toISOString()}));dirty=false;$('saveStatus').innerHTML='● <span>All changes saved</span>';$('saveStatus').style.color='#07862a';if(showToast)toast('Draft saved locally in this browser.');}catch(e){toast('Local save unavailable. Export your work before closing.');}}
  function makeRevision(){try{const list=JSON.parse(localStorage.getItem(revisionsKey)||'[]');list.unshift({html:article.innerHTML,at:new Date().toISOString()});localStorage.setItem(revisionsKey,JSON.stringify(list.slice(0,8)));}catch(e){}}
  function loadDraft(){try{let d=JSON.parse(localStorage.getItem(draftKey)||'null');if(d?.html){article.innerHTML=d.html;$('metaTitle').value=d.title||'';$('metaDescription').value=d.description||'';$('primaryKeyword').value=d.keyword||'';$('altText').value=d.alt||'';}}catch(e){}}
  function outline(){
    const root=$('outline');root.replaceChildren();
    const hero=document.createElement('div');hero.className='outline-row';hero.innerHTML='<span class="drag">⋮</span><span class="hlabel">▧</span><span class="outline-text">Hero Section<br><small>Featured image and header</small></span>';root.appendChild(hero);
    const hs=getHeadings();
    if(!outlineInitialised){hs.forEach((h,i)=>{if(h.tagName==='H2')collapsed.add('heading-'+i);});outlineInitialised=true;}
    let parentId='';let hiddenDepth=7;
    hs.forEach((h,i)=>{
      const level=Number(h.tagName[1]);const id='heading-'+i;h.dataset.outlineId=id;
      if(level<=2){parentId=id;hiddenDepth=7;}
      if(hiddenDepth<level) return;
      if(level>=3 && collapsed.has(parentId))return;
      if(level>=4 && collapsed.has('heading-'+(i-1)))return;
      const next=hs.slice(i+1).find(x=>Number(x.tagName[1])<=level);
      const nextIndex=next?hs.indexOf(next):hs.length;
      const hasChildren=hs.slice(i+1,nextIndex).some(x=>Number(x.tagName[1])>level);
      const row=document.createElement('div');row.className=`outline-row h${level} depth-${level}`;
      const drag=document.createElement('span');drag.className='drag';drag.textContent='⋮';
      const tag=document.createElement('span');tag.className='hlabel';tag.textContent=h.tagName;
      const label=document.createElement('span');label.className='outline-text';label.textContent=text(h)||'(Untitled heading)';
      row.append(drag,tag,label);
      row.addEventListener('click',()=>{h.scrollIntoView({behavior:'smooth',block:'center'});h.focus();[...root.children].forEach(x=>x.classList.remove('selected'));row.classList.add('selected');});
      if(hasChildren){const toggle=document.createElement('button');toggle.type='button';toggle.className='toggle-sub';toggle.textContent=collapsed.has(id)?'›':'⌄';toggle.setAttribute('aria-label',collapsed.has(id)?'Expand subsection':'Collapse subsection');toggle.addEventListener('click',(e)=>{e.stopPropagation();collapsed.has(id)?collapsed.delete(id):collapsed.add(id);outline();});row.appendChild(toggle);}
      root.appendChild(row);
    });
    document.dispatchEvent(new CustomEvent("av:outline-rendered"));
  }
  function preview(){const clone=article.cloneNode(true);clone.removeAttribute('contenteditable');clone.querySelectorAll('.remove-media').forEach(x=>x.remove());clone.querySelectorAll('.av-form-tools,.av-form-insert-marker').forEach(x=>x.remove());clone.querySelectorAll('[contenteditable]').forEach(x=>x.removeAttribute('contenteditable'));const hero=clone.querySelector('img');if(hero)hero.alt=$('altText').value;$('renderedArticle').innerHTML=clone.innerHTML;}
  function metrics(){const body=text(article);const words=(body.match(/\b[\p{L}\p{N}'’-]+\b/gu)||[]).length;$('wordCount').textContent=words.toLocaleString();$('readTime').textContent=Math.max(1,Math.ceil(words/225))+' min';return words;}
  function seo(){
    const headings=getHeadings(), levels=headings.map(h=>+h.tagName[1]);const h1count=levels.filter(n=>n===1).length;
    const jumps=levels.some((n,i)=>i>0 && n>levels[i-1]+1);
    const mainTitle=text(headings.find(h=>h.tagName==='H1'));const plain=text(article).toLowerCase();const keyword=$('primaryKeyword').value.trim().toLowerCase();
    const links=[...article.querySelectorAll('a[href]')].filter(a=>{try{return new URL(a.href,location.href).host===location.host}catch(e){return false}});
    const imgs=[...article.querySelectorAll('img')];const words=metrics();
    const checks=[
      ['Exactly one H1',h1count===1],['Heading levels follow logical order',!jumps && levels.length>0],['No empty headings',headings.every(h=>!!text(h))],['Article title is descriptive',mainTitle.length>=20 && mainTitle.length<=85],['SEO title present',$('metaTitle').value.trim().length>=20],['Meta description present',$('metaDescription').value.trim().length>=70],['Primary keyword appears in article',!!keyword && plain.includes(keyword)],['At least one H2',levels.includes(2)],['Image alt text present',imgs.every(img=>!!(img===article.querySelector('.hero-figure img') ? $('altText').value.trim():img.alt?.trim()))],['Content has useful detail',words>=300],['Internal links included',links.length>=1],['Article includes a list',article.querySelectorAll('ul,ol').length>0]
    ];
    const pass=checks.filter(([,ok])=>ok).length;const score=Math.round(pass/checks.length*100);
    $('scoreValue').textContent=score;$('scoreLabel').textContent=score>=85?'Good content checks':score>=60?'Needs a few improvements':'Needs attention';$('footerSeoStatus').textContent=score>=85?'Good':score>=60?'Review':'Improve';$('compactSeoBadge').textContent=`SEO checks: ${pass}/${checks.length} passed`;
    $('checkCount').textContent=`(${pass}/${checks.length})`;
    $('seoChecklist').innerHTML=checks.map(([label,ok])=>`<div class="check-row"><span style="color:${ok?'#079329':'#df8400'}">${ok?'✓':'!'}</span>${escapeHtml(label)}</div>`).join('');
    const insights=[];insights.push([h1count===1&&!jumps, h1count!==1?'Use exactly one H1 heading':jumps?'Review skipped heading levels':'Heading structure is logically organized']);insights.push([links.length>=1,links.length?'Internal link included':'Add a relevant internal link']);insights.push([words>=300,words>=300?'Content has useful supporting detail':'Add more useful supporting detail']);
    $('seoInsights').innerHTML=insights.map(([ok,message])=>`<div class="insight ${ok?'good':'warn'}"><span>${ok?'✔':'●'}</span><div>${escapeHtml(message)}</div></div>`).join('');
    const count={};for(let n=1;n<=6;n++)count['H'+n]=levels.filter(x=>x===n).length;
    $('headingAnalysis').innerHTML=Object.entries(count).map(([tag,n])=>`<span style="display:inline-block;padding:5px 8px;margin:2px;background:#eaf3ff;border-radius:8px">${tag}: <b>${n}</b></span>`).join('')+(jumps?'<p>Review skipped heading levels for clarity.</p>':'<p>Levels follow a logical hierarchy.</p>');
    $('keywordDisplay').textContent=$('primaryKeyword').value||'Not set';
  }
  function updateAll(){outline();preview();seo();}
  article.addEventListener('input',markDirty);article.addEventListener('keyup',saveSelection);article.addEventListener('mouseup',saveSelection);
  article.addEventListener('click',()=>{let h=headingAncestor(window.getSelection()?.anchorNode);if(h)$('headingSelect').value=/^H[1-6]$/.test(h.tagName)?h.tagName:'P';});
  let autoSaveTimer;article.addEventListener('input',()=>{clearTimeout(autoSaveTimer);autoSaveTimer=setTimeout(()=>saveDraft(),1500);});
  $('headingSelect').addEventListener('pointerdown',saveSelection);
  $('headingSelect').addEventListener('change',e=>{const tag=e.target.value;article.focus();restoreSelection();let node=headingAncestor(window.getSelection()?.anchorNode);if(node && /^H[1-6]$|^P$/.test(node.tagName)){const next=document.createElement(tag.toLowerCase());next.innerHTML=node.innerHTML;node.replaceWith(next);const range=document.createRange();range.selectNodeContents(next);range.collapse(false);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}else{document.execCommand('formatBlock',false,tag);}markDirty();});
  document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('mousedown',e=>e.preventDefault()));
  document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>{article.focus();restoreSelection();if(b.dataset.command==='createLink'){let url=prompt('Enter link URL (https://...)');if(!url)return;try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))throw Error();document.execCommand('createLink',false,u.href);}catch(e){toast('Please enter a valid HTTP or HTTPS link.');return;}}else{document.execCommand(b.dataset.command,false,null);}markDirty();}));
  $('addSectionBtn').addEventListener('click',()=>{const h=document.createElement('h2');h.textContent='New Section';const p=document.createElement('p');p.textContent='Start writing here…';article.append(h,p);h.scrollIntoView({behavior:'smooth'});h.focus();markDirty();});
  $('saveBtn').addEventListener('click',()=>{makeRevision();saveDraft(true);});
  $('publishBtn').addEventListener('click',()=>$('publishDialog').showModal());
  $('historyBtn').addEventListener('click',()=>{let list=[];try{list=JSON.parse(localStorage.getItem(revisionsKey)||'[]')}catch(e){}$('revisions').innerHTML=list.length?'': '<p>No manually saved revisions yet.</p>';list.forEach((r,i)=>{const row=document.createElement('div');row.className='history-row';const label=document.createElement('span');label.textContent=new Date(r.at).toLocaleString();const restore=document.createElement('button');restore.textContent='Restore';restore.type='button';restore.className='button ghost';restore.onclick=()=>{if(confirm('Restore this local revision? Current unsaved content will be replaced.')){article.innerHTML=r.html;markDirty();$('historyDialog').close();toast('Revision restored. Save draft to keep it.');}};row.append(label,restore);$('revisions').appendChild(row);});$('historyDialog').showModal();});
  ['metaTitle','metaDescription','primaryKeyword','altText'].forEach(id=>$(id).addEventListener('input',()=>{markDirty();clearTimeout(autoSaveTimer);autoSaveTimer=setTimeout(()=>saveDraft(),1500);}));
  const switchRight=(name)=>{const p=name==='preview';$('previewView').hidden=!p;$('optimizeView').hidden=p;$('previewTab').classList.toggle('active',p);$('optimizeTab').classList.toggle('active',!p);$('previewTab').setAttribute('aria-selected',p);$('optimizeTab').setAttribute('aria-selected',!p);if(p)preview();};
  $('previewTab').onclick=()=>switchRight('preview');$('topPreviewBtn').onclick=()=>switchRight('preview');$('optimizeTab').onclick=()=>switchRight('optimize');$('footerSeoBtn').onclick=()=>switchRight('optimize');$('seeOptimizeBtn').onclick=()=>switchRight('optimize');$('refreshPreview').onclick=()=>{preview();toast('Preview refreshed.');};
  document.querySelectorAll('[data-device]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-device]').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('previewFrame').className='preview-frame '+b.dataset.device;});
  $('focusBtn').onclick=()=>{const on=$('workspace').classList.toggle('focus');$('focusBtn').setAttribute('aria-pressed',on);$('focusBtn').textContent=on?'↙ Exit Focus':'⛶ Focus Mode';};
  $('outlineCollapse').onclick=()=>{$('outlinePanel').classList.toggle('collapsed');$('outlineCollapse').textContent=$('outlinePanel').classList.contains('collapsed')?'⌄':'⌃';};
  const openMega=()=>{$('megaMenu').hidden=false;$('menuBackdrop').hidden=false;$('exploreBtn').setAttribute('aria-expanded','true');$('menuSearch').focus();};
  const closeMega=()=>{$('megaMenu').hidden=true;$('menuBackdrop').hidden=true;$('exploreBtn').setAttribute('aria-expanded','false');$('exploreBtn').focus();};
  $('exploreBtn').onclick=()=> $('megaMenu').hidden?openMega():closeMega();$('closeMega').onclick=closeMega;$('menuBackdrop').onclick=closeMega;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('megaMenu').hidden)closeMega();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();makeRevision();saveDraft(true);}});
  $('menuSearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.mega-col a').forEach(a=>a.hidden=!a.textContent.toLowerCase().includes(q));};
  document.querySelectorAll('[data-ai],#aiRewriteBtn').forEach(b=>b.onclick=()=>toast('AI actions are UI placeholders. Connect a secure backend API to enable generated edits and accept/reject comparison.'));
  // Rich formatting: selection is saved before a toolbar/color picker takes focus.
  function execFormat(command, value=null){article.focus();restoreSelection();document.execCommand(command,false,value);saveSelection();markDirty();}
  ['textColor','highlightColor'].forEach(id=>{
    $(id).addEventListener('pointerdown',saveSelection);
    $(id).addEventListener('change',e=>{
      if(id==='textColor'){execFormat('foreColor',e.target.value);$('colorSwatch').style.background=e.target.value;}
      else execFormat('hiliteColor',e.target.value);
    });
  });
  $('moreToolsBtn').addEventListener('click',()=>{const panel=$('moreToolsPanel');panel.hidden=!panel.hidden;$('moreToolsBtn').setAttribute('aria-expanded',String(!panel.hidden));});
  $('insertRuleBtn').addEventListener('click',()=>execFormat('insertHorizontalRule'));
  // Selection-preserving media insertion supports local image uploads and allowed video hosts.
  let mediaKind='image';
  function openMedia(kind){mediaKind=kind;saveSelection();$('mediaTitle').textContent=kind==='video'?'Insert video':'Insert image';$('mediaHint').textContent=kind==='video'?'Paste a YouTube, Vimeo, or direct MP4/WebM video URL.':'Paste an HTTPS image URL or select an image file.';$('mediaUrl').placeholder=kind==='video'?'https://www.youtube.com/watch?v=…':'https://example.com/photo.jpg';$('mediaUrl').value='';$('mediaHelp').textContent=kind==='video'?'Supported: YouTube, Vimeo, direct HTTPS .mp4/.webm':'Supported: HTTPS image URLs or local PNG, JPEG, WebP, GIF';$('uploadArea').hidden=kind!=='image';$('mediaFile').value='';$('mediaDialog').showModal();}
  $('addImageBtn').onclick=()=>openMedia('image');
  $('addVideoBtn').onclick=()=>openMedia('video');
  $('mediaCancel').onclick=()=>$('mediaDialog').close();
  function safeMediaUrl(raw, kind){
    let u;try{u=new URL(raw);}catch(e){throw new Error('Enter a valid URL.');}
    if(u.protocol!=='https:')throw new Error('Media URLs must use HTTPS.');
    if(u.username||u.password)throw new Error('Credentials in URLs are not allowed.');
    if(kind==='image'){return {type:'image',url:u.href};}
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='youtu.be'||host==='youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com'){
      const id=host==='youtu.be'?u.pathname.slice(1).split('/')[0] : u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
      if(!id||!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('Enter a valid YouTube video URL.');
      return {type:'embed',url:'https://www.youtube-nocookie.com/embed/'+id};
    }
    if(host==='vimeo.com'||host==='player.vimeo.com'){
      const match=u.pathname.match(/(?:\/video)?\/(\d+)(?:\/|$)/);
      if(!match)throw new Error('Enter a valid Vimeo video URL.');
      return {type:'embed',url:'https://player.vimeo.com/video/'+match[1]};
    }
    if(/\.(mp4|webm)$/i.test(u.pathname))return {type:'video',url:u.href};
    throw new Error('Use YouTube, Vimeo, or a direct HTTPS MP4/WebM URL.');
  }
  const htmlAttr=x=>escapeHtml(x);
  function insertMedia(item){
    let html='';
    if(item.type==='image')html=`<figure class="media-block" contenteditable="false"><button class="remove-media" type="button" title="Remove image">✕ Remove</button><img src="${htmlAttr(item.url)}" alt="Inserted article image" style="max-width:100%;height:auto;border-radius:7px"><figcaption>Image caption</figcaption></figure>`;
    else if(item.type==='embed')html=`<figure class="media-block" contenteditable="false"><button class="remove-media" type="button" title="Remove video">✕ Remove</button><iframe src="${htmlAttr(item.url)}" title="Embedded video" loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><figcaption>Video caption</figcaption></figure>`;
    else html=`<figure class="media-block" contenteditable="false"><button class="remove-media" type="button" title="Remove video">✕ Remove</button><video controls preload="metadata" src="${htmlAttr(item.url)}"></video><figcaption>Video caption</figcaption></figure>`;
    article.focus();restoreSelection();document.execCommand('insertHTML',false,html+'<p><br></p>');markDirty();
  }
  $('mediaForm').addEventListener('submit',async e=>{
    e.preventDefault();const file=$('mediaFile').files[0];const url=$('mediaUrl').value.trim();
    try{
      if(mediaKind==='image'&&file){
        if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Choose a PNG, JPEG, WebP, or GIF image.');
        if(file.size>900000)throw new Error('Choose an image under 900 KB for local demo saving. Production will upload images to cloud storage.');
        const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
        insertMedia({type:'image',url:dataUrl});
      }else{
        if(!url)throw new Error('Provide a media URL or select an image.');
        insertMedia(safeMediaUrl(url,mediaKind));
      }
      $('mediaDialog').close();toast(mediaKind==='video'?'Video inserted.':'Image inserted.');
    }catch(err){toast(err.message||'Unable to insert media.');}
  });
  article.addEventListener('click',e=>{const b=e.target.closest('.remove-media');if(b){e.preventDefault();const block=b.closest('.media-block');if(block){block.remove();markDirty();toast('Media removed.');}}});
  // Paste text only; prevent pasted remote HTML/scripts from entering local drafts or preview.
  article.addEventListener('paste',e=>{const str=e.clipboardData?.getData('text/plain');if(typeof str==='string'){e.preventDefault();document.execCommand('insertText',false,str);markDirty();}});

  document.querySelectorAll('[data-editor-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-editor-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');switch(b.dataset.editorTab){case 'write':article.focus();break;case 'optimize':switchRight('optimize');break;case 'settings':$('advancedSeo').open=true;$('advancedSeo').scrollIntoView({behavior:'smooth',block:'nearest'});break;case 'insert':$('addSectionBtn').click();break;case 'ask':toast('Ask AI requires a backend API. This prototype does not call an AI service.');break;}});
  document.querySelectorAll('.nav-link:not(.current):not(.explore),.mega-col a,.support-btn').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();toast('Navigation destination is not connected in this standalone prototype.');}));
  loadDraft(); updateAll();
})();
