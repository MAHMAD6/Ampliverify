/* AmpliVerify V7: video upload extension; preserves existing URL/video/image insert behavior. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const article=$('article'), form=$('mediaForm'), chooser=$('videoUploadFile'), poster=$('videoPosterFile');
  const videoArea=$('videoUploadArea'), status=$('videoUploadStatus'), progress=$('videoUploadProgress');
  const zone=$('videoDropZone'), dialog=$('mediaDialog');
  let uploading=false, activeXhr=null, savedRange=null;
  const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function isVideoFile(f){return !!f && ['video/mp4','video/webm'].includes(f.type) && /\.(mp4|webm)$/i.test(f.name);}
  function setStatus(s){status.textContent=s;}
  function updateVisible(){
    const video=$('mediaTitle').textContent.toLowerCase().includes('video');
    videoArea.hidden=!video;
    if(video){$('mediaHint').textContent='Paste a video URL, or upload an MP4/WebM video from your computer.';
      $('mediaHelp').textContent='YouTube · Vimeo · HTTPS MP4/WebM · local upload';}
  }
  $('addVideoBtn').addEventListener('click',()=>{chooser.value='';poster.value='';setStatus('');updateVisible();});
  $('addImageBtn').addEventListener('click',()=>{videoArea.hidden=true;});
  // Keystrokes and clicks do not change selection while the modal is displayed.
  article.addEventListener('mouseup',()=>{const s=getSelection();if(s?.rangeCount && article.contains(s.anchorNode))savedRange=s.getRangeAt(0).cloneRange();});
  article.addEventListener('keyup',()=>{const s=getSelection();if(s?.rangeCount && article.contains(s.anchorNode))savedRange=s.getRangeAt(0).cloneRange();});
  function sourceConfig(){
    const base=($('backendUrl').value||'').trim().replace(/\/$/,'');
    if(!/^https:\/\/[^/]+$/.test(base)&&!/^http:\/\/(?:localhost|127\.0\.0\.1):3000$/.test(base))throw Error('Use an HTTPS media backend or local development API.');
    const ws=$('workspaceId').value.trim();if(!/^[\w-]{3,100}$/.test(ws))throw Error('Configure a valid workspace ID in Connections.');
    const token=globalThis.AMPLIVERIFY_TOKEN?.()||globalThis.AMPLIVERIFY_ACCESS_TOKEN||$('backendKey').value.trim();
    if(!token)throw Error('Connect your signed-in AmpliVerify workspace or configure a local developer token.');
    return {base,ws,token,path:`${base}/api/workspaces/${encodeURIComponent(ws)}/media`};
  }
  async function jsonRequest(url,body,token){
    const r=await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.detail||`Upload service error ${r.status}`);return data;
  }
  async function transferFile(file,config,label){
    const init=await jsonRequest(config.path+'/init',{filename:file.name,content_type:file.type,size:file.size},config.token);
    const result=await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();activeXhr=xhr;xhr.open(init.method,init.upload_url,true);
      if(init.method==='PUT'){xhr.setRequestHeader('Content-Type',file.type);}
      xhr.upload.onprogress=e=>{if(e.lengthComputable){const pct=Math.floor(100*e.loaded/e.total);progress.value=pct;$('videoUploadProgressLabel').textContent=`${label}: ${pct}%`;}};
      xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error(`Upload failed (HTTP ${xhr.status})`));
      xhr.onerror=()=>reject(Error('Upload connection failed'));xhr.onabort=()=>reject(Error('Upload canceled'));
      if(init.method==='POST'){const form=new FormData();Object.entries(init.fields||{}).forEach(([k,v])=>form.append(k,v));form.append('file',file);xhr.send(form);}else xhr.send(file);
    });
    activeXhr=null;
    const done=await jsonRequest(config.path+'/complete',{upload_id:init.upload_id,content_type:file.type,size:file.size},config.token);
    return await awaitApproval(done,config,label);
  }
  // AmpliVerify media pipeline: wait for verification and scanning; only approved media gets a playable HTTPS URL.
  async function awaitApproval(done,config,label){
    const until=Date.now()+120000;let state=done;
    while(['quarantine','processing','uploading'].includes(state.status)&&Date.now()<until){
      setStatus(label+' received. Verifying and scanning…');await new Promise(r=>setTimeout(r,2000));
      const r=await fetch(config.path+'/'+encodeURIComponent(done.upload_id)+'/status',{headers:{'Authorization':'Bearer '+config.token},cache:'no-store'});
      state=await r.json().catch(()=>({}));if(!r.ok)throw Error(state.detail||'Media status unavailable ('+r.status+')');
    }
    if(state.status==='approved'&&/^https?:\/\//.test(state.url||''))return {...state,status:'ready'};
    if(['rejected','failed'].includes(state.status))throw Error(label+' was not approved: '+(state.error?.message||state.status)+'.');
    return state;
  }
  function posterFromVideo(file){return new Promise(resolve=>{
    const url=URL.createObjectURL(file),v=document.createElement('video');let done=false;
    const finish=blob=>{if(done)return;done=true;v.removeAttribute('src');v.load();URL.revokeObjectURL(url);resolve(blob);};
    const timeout=setTimeout(()=>finish(null),7000);
    v.preload='auto';v.muted=true;v.playsInline=true;
    v.addEventListener('loadedmetadata',()=>{try{v.currentTime=Math.min(0.5,Math.max(0,v.duration/3||0));}catch(e){finish(null);}}, {once:true});
    v.addEventListener('seeked',()=>{try{const c=document.createElement('canvas');c.width=Math.min(960,v.videoWidth||640);c.height=Math.max(1,Math.round(c.width*(v.videoHeight||360)/(v.videoWidth||640)));c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(blob=>{clearTimeout(timeout);finish(blob);},'image/jpeg',.82);}catch(e){clearTimeout(timeout);finish(null);}}, {once:true});
    v.onerror=()=>{clearTimeout(timeout);finish(null);};v.src=url;
  });}
  function makeBlock(videoUrl,posterUrl,filename){
    const figure=document.createElement('figure');figure.className='media-block uploaded-video-block';figure.contentEditable='false';
    const remove=document.createElement('button');remove.className='remove-media';remove.type='button';remove.textContent='✕ Remove';
    const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=videoUrl;
    if(posterUrl)video.poster=posterUrl;
    const caption=document.createElement('figcaption');caption.textContent='Video: '+filename;
    figure.append(remove,video,caption);return figure;
  }
  function insertBlock(block,atDrop=false){
    if(atDrop){article.append(block);}else{
      article.focus();try{if(savedRange&&article.contains(savedRange.commonAncestorContainer)){
        const sel=getSelection();sel.removeAllRanges();sel.addRange(savedRange);savedRange.deleteContents();savedRange.insertNode(block);
      }else article.append(block);}catch(e){article.append(block);}}
    article.dispatchEvent(new Event('input',{bubbles:true}));
  }
  async function perform(file,atDrop=false){
    if(uploading)throw Error('Another upload is in progress');
    if(!isVideoFile(file))throw Error('Select a valid MP4 or WebM file.');
    if(file.size>100*1024*1024)throw Error('Video exceeds the 100 MB upload limit.');
    const config=sourceConfig();uploading=true;progress.value=0;$('videoUploadProgressWrap').hidden=false;$('videoCancelUpload').hidden=false;
    $('mediaInsert').disabled=true;setStatus('Uploading video…');
    try{
      const result=await transferFile(file,config,'Video');let posterUrl='';
      let posterFile=poster.files[0];
      if(!posterFile && $('videoAutoPoster').checked){setStatus('Generating video thumbnail…');const thumb=await posterFromVideo(file);if(thumb)posterFile=new File([thumb],'poster.jpg',{type:'image/jpeg'});}
      if(posterFile){
        if(!['image/jpeg','image/png','image/webp'].includes(posterFile.type)||posterFile.size>4*1024*1024)throw Error('Poster must be JPEG/PNG/WebP under 4 MB. Video is uploaded; retry poster or remove it.');
        setStatus('Uploading poster…');{ const uploadedPoster=await transferFile(posterFile,config,'Poster');posterUrl=uploadedPoster.status==='ready' && /^https:\/\//.test(uploadedPoster.url||'') ? uploadedPoster.url : ''; }
      }
      // Upload completion is NOT clearance for public playback. An approved URL is mandatory.
      if(result.status!=='ready' || !/^https:\/\//.test(result.url||'')){
        setStatus('Upload received. Media is quarantined pending scanning and processing; nothing was inserted. Reopen Insert Video after approval, or insert an approved HTTPS URL.');
        return;
      }
      insertBlock(makeBlock(result.url,posterUrl,file.name),atDrop);
      setStatus('Approved video inserted. Check playback and destination CMS compatibility.');
      if(dialog.open)dialog.close();
    }finally{uploading=false;activeXhr=null;$('mediaInsert').disabled=false;$('videoCancelUpload').hidden=true;$('videoUploadProgressWrap').hidden=true;}
  }
  $('videoCancelUpload').addEventListener('click',()=>activeXhr?.abort());
  $('videoDropZone').addEventListener('click',()=>chooser.click());
  $('videoDropZone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooser.click();}});
  for(const evt of ['dragenter','dragover'])zone.addEventListener(evt,e=>{e.preventDefault();zone.classList.add('over');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('over'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('over');const f=e.dataTransfer?.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);chooser.files=dt.files;setStatus('Selected: '+f.name);}});
  form.addEventListener('submit',e=>{
    if(videoArea.hidden||!chooser.files.length)return;
    e.preventDefault();e.stopImmediatePropagation();perform(chooser.files[0]).catch(err=>setStatus(err.message||'Upload error'));
  },true);
  article.addEventListener('dragover',e=>{if([...e.dataTransfer?.items||[]].some(i=>i.kind==='file'&&i.type.startsWith('video/'))){e.preventDefault();e.dataTransfer.dropEffect='copy';}},true);
  article.addEventListener('drop',e=>{const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('video/'));
    if(!file)return;e.preventDefault();e.stopImmediatePropagation();perform(file,true).catch(err=>alert(err.message||'Video upload failed'));
  },true);
})();
