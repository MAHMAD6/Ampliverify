/* V6: self-contained export UI; does not modify the editor, AI or CMS connectors. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const status=s=>{$('exportStatus').textContent=s;};
const cleanNode=()=>{
  const node=$('article').cloneNode(true);
  node.querySelectorAll('.remove-media,.article-drag-handle,[data-editor-only],.move-history-btn').forEach(x=>x.remove());
  node.querySelectorAll('[draggable],[contenteditable],.block-drop-target,.block-moving').forEach(x=>{
    x.removeAttribute('draggable');x.removeAttribute('contenteditable');x.classList.remove('block-drop-target','block-moving');
  });
  node.querySelectorAll('[onload],[onclick],[onerror],[onmouseover]').forEach(x=>{['onload','onclick','onerror','onmouseover'].forEach(y=>x.removeAttribute(y));});
  node.querySelectorAll('script,style,form,input,button').forEach(x=>x.remove());
  return node;
};
const articleData=()=>{
 const clone=cleanNode();
 const title=(clone.querySelector('h1')?.textContent||$('metaTitle').value||'Untitled article').trim().slice(0,300);
 return {title,html:clone.innerHTML,description:$('metaDescription').value.trim(),keyword:$('primaryKeyword').value.trim()};
};
const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const slug=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'ampliverify-article';
function htmlDoc(data,includeSeo){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.title)}</title>${includeSeo?`<meta name="description" content="${esc(data.description)}">`:''}<style>body{font:16px/1.65 system-ui,Arial;max-width:850px;padding:30px;margin:auto;color:#143047}h1,h2,h3,h4,h5,h6{line-height:1.25;color:#062e35}figure{margin:24px 0}img,video,iframe{max-width:100%}figcaption{font-size:.9em;color:#617a84}</style></head><body><main><article>${data.html}</article>${includeSeo?`<section><hr><h2>SEO metadata</h2><p>Primary keyword: ${esc(data.keyword)}</p><p>SEO description: ${esc(data.description)}</p></section>`:''}</main></body></html>`;}
function toMd(data){
 const root=document.createElement('div');root.innerHTML=data.html;
 function convert(node){
  if(node.nodeType===Node.TEXT_NODE)return node.textContent||'';
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const t=node.tagName.toLowerCase();
  if(t==='br')return '\n';
  if(t==='img')return `![${node.getAttribute('alt')||'image'}](${node.getAttribute('src')||''})`;
  if(t==='video'||t==='iframe')return `[Video](${node.getAttribute('src')||''})`;
  const text=Array.from(node.childNodes,convert).join('');
  if(/^h[1-6]$/.test(t))return `${'#'.repeat(+t[1])} ${text.trim()}\n\n`;
  if(['b','strong'].includes(t))return `**${text}**`;
  if(['i','em'].includes(t))return `*${text}*`;
  if(t==='u')return `<u>${text}</u>`;
  if(t==='s'||t==='strike')return `~~${text}~~`;
  if(t==='a')return node.getAttribute('href')?`[${text}](${node.getAttribute('href')})`:text;
  if(t==='li')return `- ${text.trim()}\n`;
  if(t==='ul'||t==='ol')return `${text}\n`;
  if(t==='hr')return '\n---\n\n';
  if(['p','div','figure','figcaption','blockquote','table'].includes(t))return `${text.trim()}\n\n`;
  return text;
 }
 return Array.from(root.childNodes,convert).join('').trim()+'\n';
}
const toTxt=data=>{const el=document.createElement('div');el.innerHTML=data.html;return (el.innerText||el.textContent||'').trim()+'\n';};
function toJson(data,includeSeo){const el=document.createElement('div');el.innerHTML=data.html;const headings=[...el.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>({level:+h.tagName[1],text:h.textContent.trim()}));return JSON.stringify({title:data.title,html:data.html,text:toTxt(data),headings,media:[...el.querySelectorAll('img,video,iframe')].map(x=>({type:x.tagName.toLowerCase(),source:x.getAttribute('src')||'',alt:x.getAttribute('alt')||''})),...(includeSeo?{seo:{title:data.title,description:data.description,primary_keyword:data.keyword}}:{})},null,2);}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const choices={html:['text/html;charset=utf-8',htmlDoc],md:['text/markdown;charset=utf-8',toMd],txt:['text/plain;charset=utf-8',toTxt],json:['application/json;charset=utf-8',toJson]};
function endpoint(){
  const base=$('backendUrl').value.trim().replace(/\/$/,'');
  if(!/^https:\/\/[^/]+$/.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1):3000$/.test(base))throw Error('Use a secure HTTPS backend, or localhost:3000 for development.');
  const workspace=$('workspaceId').value.trim();
  if(!/^[a-zA-Z0-9_-]{3,100}$/.test(workspace))throw Error('Configure a valid workspace in Connections.');
  const token=globalThis.AMPLIVERIFY_TOKEN?.()||globalThis.AMPLIVERIFY_ACCESS_TOKEN||$('backendKey').value.trim();
  if(!token)throw Error('Word, PDF, and ZIP need the backend. Start the NestJS backend and use your authenticated workspace session.');
  return {url:base+'/api/workspaces/'+encodeURIComponent(workspace)+'/exports',token};
}
async function downloadViaBackend(data,format,seo,media){
  const {url,token}=endpoint();
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...data,format,include_seo:seo,include_media:media}),cache:'no-store'});
  if(!response.ok){const j=await response.json().catch(()=>({}));throw Error(typeof j.detail==='string'?j.detail:`Export failed (HTTP ${response.status})`);}
  const blob=await response.blob();
  if(!blob.size)throw Error('The backend returned an empty document.');
  saveBlob(blob,slug(data.title)+'.'+format);
}
function open(){status('');$('exportDialog').showModal();}
$('downloadBtn').addEventListener('click',open);
$('exportCancel').addEventListener('click',()=>$('exportDialog').close());
$('exportForm').addEventListener('submit',async e=>{
 e.preventDefault();const format=new FormData(e.currentTarget).get('exportFormat'),seo=$('exportIncludeSeo').checked,media=$('exportIncludeMedia').checked,data=articleData();
 const button=$('exportGo');button.disabled=true;status('Preparing '+format.toUpperCase()+' download…');
 try{
   if(format in choices){const [mime,fn]=choices[format];saveBlob(new Blob([fn(data,seo)],{type:mime}),slug(data.title)+'.'+format);}
   else await downloadViaBackend(data,format,seo,media);
   status('Download started. Article content was not changed.');
 }catch(err){status(err.message||'Export failed.');}
 finally{button.disabled=false;}
});
async function copy(format){const data=articleData(),output=format==='html'?data.html:toMd(data);try{await navigator.clipboard.writeText(output);status(format.toUpperCase()+' copied.');}catch(err){status('Clipboard unavailable; use the download format instead (localhost/HTTPS required).');}}
$('exportCopyHtml').onclick=()=>copy('html');$('exportCopyMd').onclick=()=>copy('md');
})();
