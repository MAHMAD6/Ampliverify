/* V13.2 offline media: independent of CMS, AI and hosted upload controllers. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const article = $('article');
  const MAX_IMAGE = 15 * 1024 * 1024;
  const MAX_VIDEO = 100 * 1024 * 1024;
  const DB_NAME = 'ampliverify-editor-local-media-v1';
  const activeUrls = new Map();
  const fileTypes = new Map([['image/png','image'],['image/jpeg','image'],['image/webp','image'],['image/gif','image'],['video/mp4','video'],['video/webm','video']]);
  let dbPromise, selectedBlock = null, preservedRange = null;
  const status = s => { if($('offlineMediaStatus')) $('offlineMediaStatus').textContent=s; };
  const notify = () => article.dispatchEvent(new Event('input',{bubbles:true}));
  const isLocal = block => block?.matches?.('.media-block[data-av-local-id]');
  const hasLocal = () => !!article.querySelector('.media-block[data-av-local-id]');
  function openDb(){
    if(!('indexedDB' in window)) return Promise.reject(Error('Browser media storage is unavailable. Use Chrome or Edge on localhost.'));
    if(!dbPromise) dbPromise = new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('media'))req.result.createObjectStore('media',{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Browser storage access denied'));
    }).catch(e=>{dbPromise=null;throw e;});
    return dbPromise;
  }
  async function putFile(id, file){const db=await openDb();return new Promise((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').put({id,file,created:Date.now(),name:file.name});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}
  async function readFile(id){const db=await openDb();return new Promise((resolve,reject)=>{
    const req=db.transaction('media','readonly').objectStore('media').get(id);
    req.onsuccess=()=>resolve(req.result?.file||null);req.onerror=()=>reject(req.error);
  });}
  async function removeFile(id){const db=await openDb();return new Promise((resolve,reject)=>{
    const tx=db.transaction('media','readwrite');tx.objectStore('media').delete(id);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });}
  function putUrl(id,file){if(activeUrls.has(id))URL.revokeObjectURL(activeUrls.get(id));const url=URL.createObjectURL(file);activeUrls.set(id,url);return url;}
  function uuid(){return 'avmedia-'+(crypto.randomUUID?.()||String(Date.now())+Math.random().toString(36).slice(2));}
  function getTopBlockAt(x,y){let target=document.elementFromPoint(x,y),n=target;while(n&&n.parentElement!==article)n=n.parentElement;return n?.parentElement===article?n:null;}
  function beforeOrAfter(block,y){return y > block.getBoundingClientRect().top + block.getBoundingClientRect().height/2;}
  function insertBlock(figure,x,y){const target=(Number.isFinite(x)&&Number.isFinite(y))?getTopBlockAt(x,y):null;
    if(target && target!==figure)article.insertBefore(figure,beforeOrAfter(target,y)?target.nextSibling:target);
    else if(preservedRange&&article.contains(preservedRange.commonAncestorContainer)){
      // Insert as a document-level block, never nested inside a paragraph or a list item.
      let anchor=preservedRange.startContainer;
      while(anchor&&anchor.parentNode!==article)anchor=anchor.parentNode;
      if(anchor?.parentNode===article)article.insertBefore(figure,anchor.nextSibling);
      else article.append(figure);
    }else article.append(figure);
    notify();figure.scrollIntoView({block:'nearest'});
  }
  function validate(file){const kind=fileTypes.get(file?.type);if(!kind||!file.name.match(kind==='image'?/\.(png|jpe?g|webp|gif)$/i:/\.(mp4|webm)$/i))throw Error('Choose PNG, JPEG, WebP, GIF, MP4 or WebM.');
    if(file.size===0||file.size>(kind==='image'?MAX_IMAGE:MAX_VIDEO))throw Error(kind==='image'?'Image must be 15 MB or smaller.':'Video must be 100 MB or smaller.');return kind;}
  function createTools(figure){if(figure.querySelector('.av-media-actions'))return;
    const tools=document.createElement('div');tools.className='av-media-actions';tools.contentEditable='false';
    for(const [label,action] of [['⠿ Move','move'],['Edit','edit'],['↑','up'],['↓','down'],['Remove','remove']]){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.mediaAction=action;b.setAttribute('aria-label',label==='↑'?'Move media up':label==='↓'?'Move media down':label);if(action==='move'){b.draggable=true;b.title='Drag media block within article';}tools.append(b);
    }
    if(figure.dataset.avLocalId){const state=document.createElement('span');state.className='av-media-local-label';state.textContent='Local • not uploaded';tools.append(state);}
    figure.prepend(tools);figure.querySelector('.remove-media')?.remove();
    if(!figure.querySelector('.av-media-resizer')){const resize=document.createElement('button');resize.type='button';resize.className='av-media-resizer';resize.title='Drag to resize media; exact values in Edit';resize.setAttribute('aria-label','Resize media');resize.textContent='↘';figure.append(resize);}
  }
  function buildFigure(id,kind,filename,url){const figure=document.createElement('figure');figure.className='media-block av-offline-media';figure.contentEditable='false';figure.dataset.avLocalId=id;figure.dataset.avMediaKind=kind;figure.dataset.avMediaName=filename;figure.dataset.avWidth='100';figure.dataset.avHeight='';figure.dataset.avAlign='center';
    const el=document.createElement(kind==='image'?'img':'video');el.src=url;el.dataset.avAsset=id;
    if(kind==='image')el.alt=filename.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ');
    else {el.controls=true;el.preload='metadata';el.playsInline=true;el.setAttribute('aria-label','Local video preview: '+filename);}
    const caption=document.createElement('figcaption');caption.textContent='';figure.append(el,caption);createTools(figure);applyDimensions(figure);return figure;}
  function applyDimensions(figure){const w=Math.max(20,Math.min(100,Number(figure.dataset.avWidth)||100));const h=Number(figure.dataset.avHeight)||0;
    figure.style.width=w+'%';figure.style.maxWidth='100%';figure.style.marginLeft=figure.dataset.avAlign==='right'?'auto':figure.dataset.avAlign==='center'?'auto':'0';figure.style.marginRight=figure.dataset.avAlign==='left'?'auto':figure.dataset.avAlign==='center'?'auto':'0';
    const media=figure.querySelector('img,video,iframe');if(media){media.style.width='100%';media.style.height=h?h+'px':'auto';media.style.objectFit='contain';}
  }
  function generatePoster(videoFile){return new Promise(resolve=>{
    const temp=URL.createObjectURL(videoFile),video=document.createElement('video');let finished=false;
    const timeout=setTimeout(()=>finish(null),5000);
    function finish(blob){if(finished)return;finished=true;clearTimeout(timeout);video.removeAttribute('src');video.load();URL.revokeObjectURL(temp);resolve(blob);}
    video.muted=true;video.playsInline=true;video.preload='auto';
    video.addEventListener('loadedmetadata',()=>{try{video.currentTime=Math.min(0.5,Math.max(0,video.duration/4||0));}catch(e){finish(null);}},{once:true});
    video.addEventListener('seeked',()=>{try{const canvas=document.createElement('canvas');canvas.width=Math.min(800,video.videoWidth||640);canvas.height=Math.round(canvas.width*(video.videoHeight||360)/(video.videoWidth||640));
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);canvas.toBlob(finish,'image/jpeg',0.78);
    }catch(e){finish(null);}},{once:true});video.addEventListener('error',()=>finish(null),{once:true});video.src=temp;
  });}
  async function attachPoster(block,posterFile){if(!block?.isConnected||!posterFile)return;
    if(!['image/jpeg','image/png','image/webp'].includes(posterFile.type)||posterFile.size>4*1024*1024)throw Error('Poster must be JPEG/PNG/WebP and no larger than 4 MB.');
    const posterId=uuid();await putFile(posterId,posterFile);block.dataset.avPosterId=posterId;
    const video=block.querySelector('video');if(video)video.poster=putUrl(posterId,posterFile);notify();
  }
  async function addFile(file,x,y,posterFile=null,autoPoster=true){const kind=validate(file);const id=uuid();
    try{await putFile(id,file);}catch(e){throw Error('Unable to save local media. Your browser may be out of storage or using restricted private mode: '+(e.message||e));}
    const figure=buildFigure(id,kind,file.name,putUrl(id,file));insertBlock(figure,x,y);
    if(kind==='video'){
      // Local preview is usable immediately. A poster is optional and non-blocking.
      if(posterFile)attachPoster(figure,posterFile).catch(err=>status('Video inserted; poster unavailable: '+err.message));
      else if(autoPoster)generatePoster(file).then(blob=>blob&&attachPoster(figure,new File([blob],'video-poster.jpg',{type:'image/jpeg'}))).catch(()=>{});
    }
    return figure;
  }
  // Remember insertion position when the user opens the media dialog.
  article.addEventListener('mouseup',()=>{const sel=getSelection();if(sel?.rangeCount&&article.contains(sel.anchorNode))preservedRange=sel.getRangeAt(0).cloneRange();});
  article.addEventListener('keyup',()=>{const sel=getSelection();if(sel?.rangeCount&&article.contains(sel.anchorNode))preservedRange=sel.getRangeAt(0).cloneRange();});
  $('addImageBtn').addEventListener('click',()=>status('Choose an image or paste an HTTPS URL. Local image insertion works without a backend.'));
  $('addVideoBtn').addEventListener('click',()=>status('Choose MP4/WebM to preview offline, or paste a YouTube/Vimeo/HTTPS URL. Local media requires upload approval before publishing.'));
  // Intercept file submissions before the existing backend upload controller and legacy 900 KB image controller.
  window.addEventListener('submit',e=>{if(e.target?.id!=='mediaForm')return;
    const video=!$('videoUploadArea').hidden;const file=video?$('videoUploadFile').files[0]:$('mediaFile').files[0];
    if(!file)return; e.preventDefault();e.stopImmediatePropagation();
    status('Saving '+file.name+' to this browser…');$('mediaInsert').disabled=true;
    addFile(file,undefined,undefined,video?$('videoPosterFile').files[0]:null,video?$('videoAutoPoster').checked:false).then(()=>{$('mediaDialog').close();status('Inserted locally. Video/image is not uploaded to the website.');})
      .catch(err=>status(err.message)).finally(()=>$('mediaInsert').disabled=false);
  },true);
  // Intercept image and video drops before the old image size check and remote-video upload handlers.
  window.addEventListener('dragover',e=>{if(!article.contains(e.target))return;const types=[...(e.dataTransfer?.items||[])];if(types.some(i=>i.kind==='file' && (i.type.startsWith('image/')||i.type.startsWith('video/')))){e.preventDefault();e.dataTransfer.dropEffect='copy';}},true);
  window.addEventListener('drop',e=>{if(!article.contains(e.target))return;
    const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
    if(!file)return;e.preventDefault();e.stopImmediatePropagation();addFile(file,e.clientX,e.clientY).catch(err=>alert(err.message));
  },true);
  // Clipboard image paste bypasses the legacy text-only paste handler.
  window.addEventListener('paste',e=>{if(!article.contains(e.target))return;
    const file=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));
    if(!file)return;e.preventDefault();e.stopImmediatePropagation();addFile(new File([file],'pasted-'+Date.now()+'.png',{type:file.type})).catch(err=>alert(err.message));
  },true);
  const prop=$('avMediaProperties');
  function edit(block){selectedBlock=block;const media=block.querySelector('img,video,iframe');$('avMediaOrigin').textContent=isLocal(block)?'Offline media · '+(block.dataset.avMediaName||'local file')+' · not uploaded':'External media URL';
    $('avMediaCaption').value=block.querySelector('figcaption')?.textContent||'';$('avMediaAlt').value=media?.getAttribute('alt')||media?.getAttribute('aria-label')||'';
    $('avMediaWidth').value=block.dataset.avWidth||'100';$('avMediaHeight').value=block.dataset.avHeight||'';$('avMediaAlign').value=block.dataset.avAlign||'center';$('avMediaPoster').value='';$('avMediaPropStatus').textContent='';$('avMediaPosterWrap').hidden=media?.tagName!=='VIDEO';prop.showModal();}
  $('avMediaPropsCancel').onclick=()=>prop.close();
  $('avMediaPropsForm').addEventListener('submit',async e=>{e.preventDefault();const block=selectedBlock;if(!block?.isConnected)return prop.close();
    const media=block.querySelector('img,video,iframe'), w=Number($('avMediaWidth').value),rawH=$('avMediaHeight').value,h=rawH?Number(rawH):0;
    if(!Number.isFinite(w)||w<20||w>100||h<0||(h&&(h<100||h>1200))){$('avMediaPropStatus').textContent='Width must be 20–100%; height Auto or 100–1200 px.';return;}
    if(media?.tagName==='VIDEO'&&$('avMediaPoster').files.length){const file=$('avMediaPoster').files[0];if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){$('avMediaPropStatus').textContent='Poster must be JPG/PNG/WebP under 4 MB.';return;}
      const id=block.dataset.avPosterId||uuid();try{await putFile(id,file);}catch(err){$('avMediaPropStatus').textContent=err.message;return;}block.dataset.avPosterId=id;media.poster=putUrl(id,file);
    }
    block.dataset.avWidth=String(w);block.dataset.avHeight=h?String(h):'';block.dataset.avAlign=$('avMediaAlign').value;
    const cap=block.querySelector('figcaption');if(cap)cap.textContent=$('avMediaCaption').value.trim();if(media?.tagName==='IMG')media.alt=$('avMediaAlt').value.trim();else if(media)media.setAttribute('aria-label',$('avMediaAlt').value.trim());
    applyDimensions(block);notify();prop.close();
  });
  function move(block,delta){const sib=delta<0?block.previousElementSibling:block.nextElementSibling;if(!sib)return;
    article.insertBefore(block,delta<0?sib:sib.nextElementSibling);notify();}
  // Existing HTTPS URL media can also be resized, moved and edited. The original URL sources remain unchanged.
  article.addEventListener('click',async e=>{const button=e.target.closest('[data-media-action]');if(!button)return;e.preventDefault();e.stopPropagation();const block=button.closest('.media-block');if(!block)return;
    switch(button.dataset.mediaAction){case 'edit':edit(block);break;case 'up':move(block,-1);break;case 'down':move(block,1);break;
      case 'remove':{block.remove();notify();/* Retain browser asset for undo/revision restoration. Garbage collection is a separate user-controlled operation. */break;}
    }
  },true);
  // Drag the bottom-right handle to resize; precise controls remain available in Edit.
  let resizing=null;
  article.addEventListener('pointerdown',e=>{const h=e.target.closest('.av-media-resizer');if(!h)return;
    const block=h.closest('.media-block');if(!block)return;e.preventDefault();e.stopPropagation();
    const rect=block.getBoundingClientRect(),parent=article.getBoundingClientRect();
    resizing={block,startX:e.clientX,startY:e.clientY,initialW:rect.width,initialH:block.querySelector('img,video,iframe')?.getBoundingClientRect().height||200,parentWidth:parent.width};
  },true);
  window.addEventListener('pointermove',e=>{if(!resizing)return;
    const {block,startX,startY,initialW,initialH,parentWidth}=resizing;
    const w=Math.max(20,Math.min(100,Math.round((initialW+e.clientX-startX)/parentWidth*100)));
    const height=Math.max(100,Math.min(1200,Math.round(initialH+e.clientY-startY)));
    block.dataset.avWidth=String(w);block.dataset.avHeight=String(height);applyDimensions(block);
  },true);
  window.addEventListener('pointerup',()=>{if(resizing){resizing=null;notify();}},true);
  let dragging=null;
  article.addEventListener('dragstart',e=>{const grip=e.target.closest('[data-media-action="move"]');if(!grip)return;dragging=grip.closest('.media-block');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','AmpliVerify media block');},true);
  article.addEventListener('dragover',e=>{if(dragging){e.preventDefault();e.dataTransfer.dropEffect='move';}},true);
  article.addEventListener('drop',e=>{if(!dragging)return;e.preventDefault();e.stopImmediatePropagation();const target=getTopBlockAt(e.clientX,e.clientY);if(target&&target!==dragging){article.insertBefore(dragging,beforeOrAfter(target,e.clientY)?target.nextSibling:target);notify();}dragging=null;},true);
  article.addEventListener('dragend',()=>dragging=null,true);
  async function restoreMedia(){for(const block of article.querySelectorAll('.media-block[data-av-local-id]')){
      createTools(block);applyDimensions(block);
      const asset=block.dataset.avLocalId;try{const file=await readFile(asset);if(!block.isConnected)continue;
        if(file){const media=block.querySelector('img,video');if(media&&(!media.src||!media.src.startsWith('blob:')||!activeUrls.has(asset)))media.src=putUrl(asset,file);delete block.dataset.avMissing;}else {block.dataset.avMissing='true';let warning=block.querySelector('.av-media-missing');if(!warning){warning=document.createElement('p');warning.className='av-media-missing';warning.textContent='Local media unavailable in this browser. Reinsert the file from your computer.';block.append(warning);}}
        if(block.dataset.avPosterId){const p=await readFile(block.dataset.avPosterId);if(p&&block.querySelector('video'))block.querySelector('video').poster=putUrl(block.dataset.avPosterId,p);}
      }catch(e){block.dataset.avMissing='true';}
    }}
  // Extend the same non-destructive controls to URL media, excluding the approved hero block.
  function decorateUrlMedia(){for(const block of article.querySelectorAll('.media-block:not([data-av-local-id])')){
      if(!block.dataset.avWidth)block.dataset.avWidth='100';if(!block.dataset.avAlign)block.dataset.avAlign='center';
      createTools(block);applyDimensions(block);
    }}
  // The editor's local draft loads synchronously; restore the corresponding blobs afterward.
  decorateUrlMedia();restoreMedia();
  // History restoration and cloud-draft loading replace DOM nodes without firing input consistently.
  new MutationObserver(()=>{clearTimeout(restoreMedia.timer);restoreMedia.timer=setTimeout(()=>{decorateUrlMedia();for(const block of article.querySelectorAll('.media-block[data-av-local-id]')){
      if(!block.querySelector('.av-media-actions')||block.querySelector('img,video')?.src?.startsWith('file:')||block.querySelector('img,video')?.src?.startsWith('blob:')&&!activeUrls.has(block.dataset.avLocalId))restoreMedia();
    }},150);}).observe(article,{childList:true,subtree:false});
  // Exporting blob: URLs to an external file makes broken media. Prevent accidental publish/export.
  function guard(event,messageId){if(messageId==='exportStatus' && document.querySelector('input[name="exportFormat"]:checked')?.value==='webpage-zip')return false;if(!hasLocal())return false;event?.preventDefault();event?.stopImmediatePropagation();
    const msg='This article includes browser-only images/videos. Upload and approve them in the production media library before publishing or exporting a portable file. Local editing and preview remain available.';
    const node=$(messageId);if(node)node.textContent=msg;else alert(msg);return true;}
  for(const id of ['externalDraftBtn','externalPublishBtn','exportHtml','copyHtml'])$(id)?.addEventListener('click',e=>guard(e,'publishResult'),true);
  $('exportForm')?.addEventListener('submit',e=>guard(e,'exportStatus'),true);
  $('exportCopyHtml')?.addEventListener('click',e=>guard(e,'exportStatus'),true);
  $('exportCopyMd')?.addEventListener('click',e=>guard(e,'exportStatus'),true);
  window.addEventListener('beforeunload',()=>{for(const url of activeUrls.values())URL.revokeObjectURL(url);});
  globalThis.AmpliVerifyOfflineMedia={hasLocal,restoreMedia};
})();
