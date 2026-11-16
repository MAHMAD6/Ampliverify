/* V9: additive, review-first content intelligence. No scraping, fabricated rankings or third-party exports. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const article=$('article');
 if(!article)return;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tokens=s=>(String(s||'').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(w=>!['the','and','for','from','with','this','that','your','are','you','our','www','https','http','com','about','into','their','how'].includes(w));
 const unique=s=>[...new Set(tokens(s))];
 const words=()=>tokens(article.innerText);
 const plain=()=>article.innerText;
 const docRoot=()=>article.cloneNode(true);
 const panels=[['links','Internal links'],['seo','SEO + GEO'],['citations','Citations & originality'],['access','Accessibility'],['brief','Content brief'],['refresh','Content refresh']];
 const dialog=document.createElement('dialog');dialog.id='avIntelligenceDialog';dialog.className='av-intel-dialog';dialog.setAttribute('aria-label','Content Intelligence');
 dialog.innerHTML=`<div class="av-intel-head"><div><h2>✦ Content Intelligence</h2><p>Analysis and editorial suggestions; none publish or overwrite without your approval.</p></div><button type="button" class="button ghost" id="avIntelClose">✕ Close</button></div><div class="av-intel-layout"><nav class="av-intel-nav" aria-label="Intelligence tools">${panels.map(([id,label])=>`<button type="button" data-intel-tab="${id}">${escape(label)}</button>`).join('')}</nav><section id="avIntelBody" class="av-intel-main" aria-live="polite"></section></div>`;
 document.body.append(dialog);
 $('avIntelClose').onclick=()=>dialog.close();
 const nav=dialog.querySelectorAll('[data-intel-tab]');
 let active='seo';let sites=[];let selectedRefresh='';let lastBrief='';
 const status=(msg)=>{const node=$('avIntelStatus');if(node)node.textContent=msg;};
 function launch(tab='seo'){active=tab;render();dialog.showModal();}
 nav.forEach(b=>b.onclick=()=>{active=b.dataset.intelTab;render();});
 // Both launch positions belong to existing progressive-disclosure areas; no new main toolbar.
 const optimize=$('optimizeView');
 if(optimize){const b=document.createElement('button');b.className='av-intel-launch';b.type='button';b.textContent='✦ Open Content Intelligence';b.onclick=()=>launch('seo');optimize.appendChild(b);const note=document.createElement('p');note.className='av-intel-summary';note.textContent='Internal links · SEO/GEO · Citations · Accessibility · Briefs · Refresh';optimize.appendChild(note);}
 const advanced=$('advancedSeo')?.querySelector('.detail-body');
 if(advanced){const b=document.createElement('button');b.type='button';b.className='av-intel-launch';b.textContent='✦ Content Intelligence & Citations';b.onclick=()=>launch('citations');advanced.appendChild(b);}
 // Ask AI already has its existing dialog. Add contextual shortcuts within that same workflow.
 const aiDialog=$('aiDialog');
 if(aiDialog){const aiNote=document.createElement('div');aiNote.className='av-intel-actions';aiNote.innerHTML='<button type="button" class="av-intel-action secondary" id="avOpenBrief">Generate Content Brief</button><button type="button" class="av-intel-action secondary" id="avOpenRefresh">Content Refresh</button>';aiDialog.querySelector('form')?.prepend(aiNote);$('avOpenBrief').onclick=()=>{aiDialog.close();launch('brief');};$('avOpenRefresh').onclick=()=>{aiDialog.close();launch('refresh');};}
 const markup=(items)=>items.map(x=>`<div class="av-intel-result ${x.ok?'av-intel-pass':'av-intel-warn'}"><strong>${x.ok?'✓':'!'} ${escape(x.title)}</strong><p>${escape(x.detail)}</p></div>`).join('');
 function safeLocalUrl(raw,base){try{let u=new URL(raw,base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;return u;}catch{return null;}}
 function linkResults(){
   const site=$('avSiteBase')?.value?.trim()||'';const entries=$('avSitePages')?.value||'';
   const root=safeLocalUrl(site,location.href);if(!root || !/^https?:\/\//.test(site)){status('Enter your real website base URL starting with https://.');return;}
   let parsed=[];let bad=0;
   for(const line of entries.split('\n').slice(0,200)){
     const cleaned=line.trim();if(!cleaned)continue;
     const [raw,label='']=cleaned.split('|');const u=safeLocalUrl(raw.trim(),root.href);
     if(!u || u.origin!==root.origin){bad++;continue;}
     parsed.push({url:u.href,title:label.trim()||u.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g,' ')||'Home'});
   }
   const candidates=[];const content=new Set(unique(plain()));const existing=new Set([...article.querySelectorAll('a[href]')].map(a=>safeLocalUrl(a.getAttribute('href'),root.href)?.href));
   for(const page of parsed){const tt=unique(page.title+' '+new URL(page.url).pathname);const match=tt.filter(x=>content.has(x));if(match.length&&!existing.has(page.url))candidates.push({...page,terms:match,score:match.length/Math.max(1,tt.length)});}
   candidates.sort((a,b)=>b.score-a.score);
   sites=candidates.slice(0,12);
   $('avLinkResult').innerHTML=(bad?`<div class="av-intel-note">Skipped ${bad} invalid or off-domain URL(s).</div>`:'')+(sites.length?sites.map((x,i)=>`<div class="av-intel-result"><strong>${escape(x.title)}</strong><p>${escape(x.url)}</p><small>Shared terms: ${escape(x.terms.join(', '))}. Check destination relevance and choose a natural anchor in the article.</small><div class="av-intel-actions"><button class="av-intel-action secondary" type="button" data-copy-link="${i}">Copy URL</button></div></div>`).join(''):'<div class="av-intel-note">No matching unpublished URLs found. Add relevant page URLs and titles, or improve topic descriptions.</div>');
   $('avLinkResult').querySelectorAll('[data-copy-link]').forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(sites[Number(b.dataset.copyLink)].url).then(()=>status('Link copied.')).catch(()=>status('Copy was unavailable; select the URL instead.')));
 }
 function seoResults(){
   const key=$('primaryKeyword')?.value.trim()||'';const meta=$('metaDescription')?.value.trim()||'';const title=$('metaTitle')?.value.trim()||'';const body=plain();const hs=[...article.querySelectorAll('h1,h2,h3,h4,h5,h6')];
   const checks=[
     {ok:hs.filter(h=>h.tagName==='H1').length===1,title:'One H1 heading',detail:'Use one descriptive main article heading.'},
     {ok:!!key && body.toLowerCase().includes(key.toLowerCase()),title:'Target topic appears in the article',detail:'Use the primary topic naturally, without keyword stuffing.'},
     {ok:title.length>=20&&title.length<=70,title:'SEO title length review',detail:`Current: ${title.length} characters. Character counts are guidelines, not ranking signals.`},
     {ok:meta.length>=70&&meta.length<=165,title:'Meta description review',detail:`Current: ${meta.length} characters. Search engines may generate their own snippets.`},
     {ok:hs.every(h=>h.textContent.trim().length>0),title:'Headings have clear labels',detail:'Avoid empty headings; H3–H6 are optional when unnecessary.'},
     {ok:article.querySelectorAll('a[href]').length>0,title:'Helpful source or navigation links',detail:'Relevant, working links can help readers navigate and verify information.'},
     {ok:article.querySelectorAll('p').length>=4,title:'Structured, readable explanation',detail:'Give readers useful answers and context rather than optimizing for arbitrary word counts.'}
   ];
   const matched=checks.filter(x=>x.ok).length;
   $('avSeoResult').innerHTML=`<div class="av-intel-kicker">Editorial checks: <span class="av-intel-score">${matched}/${checks.length}</span> passed</div>`+markup(checks)+`<div class="av-intel-note">GEO readiness is an editorial checklist, not a verified AI-citation or ranking score. Human review is required for factual claims, original experience and citations.</div>`;
 }
 function citationResults(){
   const paragraphs=[...article.querySelectorAll('p,li')].filter(n=>!n.closest('.media-block'));
   const cue=/(\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s?%|\b(?:studies|research|survey|data show|according to|proven|guaranteed|always|never|most|best|latest)\b)/i;
   const flagged=paragraphs.filter(p=>cue.test(p.textContent)).slice(0,30);
   const anchors=[...article.querySelectorAll('a[href]')];const empty=anchors.filter(a=>!a.textContent.trim()||a.textContent.trim().length<3);
   const repeated=[];const seen=new Map();
   for(const p of paragraphs){const normalized=p.textContent.replace(/\s+/g,' ').trim().toLowerCase();if(normalized.length>70){if(seen.has(normalized))repeated.push(p.textContent.trim());seen.set(normalized,true);}}
   $('avCitationResult').innerHTML=`<div class="av-intel-note">This is an on-page heuristic review. It does NOT verify external sources, test live links, detect plagiarism across the web, or certify originality.</div>`+markup([
     {ok:flagged.length===0,title:'Claims needing evidence',detail:`${flagged.length} passage(s) contain dates, quantities or strong assertions worth checking against reliable sources.`},
     {ok:repeated.length===0,title:'Repeated passages',detail:`${repeated.length} identical longer passage(s) inside this article. This is not an external plagiarism scan.`},
     {ok:empty.length===0,title:'Link text quality',detail:`${empty.length} link(s) have empty or uninformative anchor text.`}
   ])+flagged.map(p=>`<div class="av-intel-result av-intel-warn"><strong>Verify before publishing</strong><p>${escape(p.textContent.trim().slice(0,240))}</p></div>`).join('');
 }
 function accessResults(){
   const imgs=[...article.querySelectorAll('img')];const missing=imgs.filter(i=>!i.alt?.trim() && !i.closest('.hero-figure'));
   const hero=article.querySelector('.hero-figure img');if(hero&&!($('altText')?.value||'').trim())missing.push(hero);
   const heads=[...article.querySelectorAll('h1,h2,h3,h4,h5,h6')];const skips=[];heads.forEach((h,i)=>{if(i && Number(h.tagName[1])>Number(heads[i-1].tagName[1])+1)skips.push(h.textContent.trim());});
   const generic=[...article.querySelectorAll('a')].filter(a=>/^(click here|read more|here|link)$/i.test(a.textContent.trim()));
   const unlabeled=[...article.querySelectorAll('iframe')].filter(a=>!a.getAttribute('title'));
   const forms=[...article.querySelectorAll('form')];
   $('avAccessResult').innerHTML=markup([
     {ok:missing.length===0,title:'Image alternatives',detail:`${missing.length} image(s) missing meaningful alternative text. Decorative images may use alt="" when appropriate.`},
     {ok:skips.length===0,title:'Heading navigation',detail:`${skips.length} heading level jump(s) flagged for review; headings should communicate hierarchy.`},
     {ok:generic.length===0,title:'Descriptive link text',detail:`${generic.length} generic link label(s) found.`},
     {ok:unlabeled.length===0,title:'Embedded-frame titles',detail:`${unlabeled.length} iframe(s) have no title.`},
     {ok:forms.length===0,title:'Embedded forms need separate audit',detail:forms.length?`${forms.length} form(s) present. Verify labels, validation messages, keyboard access, consent, and published embeds.`:'No inline form elements found; hosted form embeds require separate verification.'}
   ])+`<div class="av-intel-note">Automated checks cannot establish WCAG conformance. Run keyboard, screen-reader, contrast and live-site testing before publication.</div>`;
 }
 function refreshResults(){
   const cue=/(\b(?:19|20)\d{2}\b|\b(?:latest|recently|currently|now|today|this year|last year|new|upcoming)\b|\b\d+(?:\.\d+)?\s?%)/i;
   const list=[...article.querySelectorAll('p,li,h2,h3')].filter(n=>cue.test(n.textContent)).slice(0,30);
   $('avRefreshResult').innerHTML=`<div class="av-intel-note">Potentially dated statements are flags, not verified inaccuracies. Check dates, sources, claims, links and current product details before accepting an AI rewrite.</div>`+(list.length?list.map((el,i)=>`<div class="av-intel-result av-intel-warn"><strong>Review passage ${i+1}</strong><p>${escape(el.textContent.trim().slice(0,350))}</p><button type="button" class="av-intel-action secondary" data-refresh-paragraph="${i}">Select in editor</button></div>`).join(''):'<div class="av-intel-result av-intel-pass"><strong>No obvious dated-language cues</strong><p>This is not a guarantee of factual freshness.</p></div>');
   $('avRefreshResult').querySelectorAll('[data-refresh-paragraph]').forEach(b=>b.onclick=()=>{const el=list[Number(b.dataset.refreshParagraph)];dialog.close();el?.scrollIntoView({behavior:'smooth',block:'center'});const r=document.createRange();r.selectNodeContents(el);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);article.focus();});
 }
 async function generateBrief(){
   const topic=$('avBriefTopic').value.trim();const keyword=$('primaryKeyword')?.value.trim()||'';const notes=$('avBriefNotes').value.trim();
   if(!topic){status('Enter the article topic.');return;}
   const url=($('backendUrl')?.value||'http://127.0.0.1:3000').replace(/\/$/,'');const token=globalThis.AMPLIVERIFY_ACCESS_TOKEN||$('backendKey')?.value?.trim(),ws=$('workspaceId')?.value?.trim();
   if(!token||!ws){status('Open Connections and configure your authorized workspace/API token first.');return;}
   $('avIntelStatus').textContent='Generating brief…';const btn=$('avBriefGenerate');btn.disabled=true;
   try{
     const response=await fetch(`${url}/api/workspaces/${encodeURIComponent(ws)}/ai/generate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({task:'brief',topic,keyword,selected_text:'',article_excerpt:plain().slice(0,4500),target_words:600,tone:'professional',instructions:notes})});
     const data=await response.json();if(!response.ok)throw new Error(data.detail||'Generation failed');
     // The backend sanitizes; also render as text-only for analysis and copying to avoid active content.
     const doc=new DOMParser().parseFromString(data.html||'','text/html');lastBrief=doc.body.textContent||'';
     $('avBriefResult').textContent=lastBrief;$('avBriefCopy').hidden=false;status('Brief generated for review. Competitor/keyword metrics have not been researched.');
   }catch(e){status(e.message||'Generation unavailable');}finally{btn.disabled=false;}
 }
 function render(){
  nav.forEach(b=>{const current=b.dataset.intelTab===active;b.classList.toggle('active',current);b.setAttribute('aria-current',String(current));});
  const body=$('avIntelBody');
  if(active==='links'){body.innerHTML=`<h3>Internal Linking Assistant</h3><p>Paste pages from your own site as one URL per line. Add a title after | for better relevance suggestions. No website crawling or credentials required.</p><div class="av-intel-controls"><label>Website base URL<input id="avSiteBase" type="url" placeholder="https://example.com"></label><label>Site pages (URL | optional title)<textarea id="avSitePages" rows="7" maxlength="25000" placeholder="https://example.com/guides/seo | SEO guide\nhttps://example.com/services | Marketing services"></textarea></label></div><div class="av-intel-actions"><button id="avAnalyzeLinks" class="av-intel-action">Find relevant internal links</button></div><p id="avIntelStatus" role="status"></p><div id="avLinkResult"></div>`;$('avAnalyzeLinks').onclick=linkResults;}
  else if(active==='seo'){body.innerHTML='<h3>SEO + GEO Content Intelligence</h3><p>Check content structure, search-intent clarity, metadata and useful answer presentation. This does not query Google or measure AI-search citations.</p><div class="av-intel-actions"><button class="av-intel-action" id="avSeoRun">Refresh checks</button></div><div id="avSeoResult"></div>';$('avSeoRun').onclick=seoResults;seoResults();}
  else if(active==='citations'){body.innerHTML='<h3>Originality & Citation Review</h3><p>Flag claims that may need citations, duplicate passages within this article and weak link text.</p><div class="av-intel-actions"><button class="av-intel-action" id="avCitationRun">Recheck article</button></div><div id="avCitationResult"></div>';$('avCitationRun').onclick=citationResults;citationResults();}
  else if(active==='access'){body.innerHTML='<h3>Accessibility Checker</h3><p>Check the authored article for image alternatives, heading structure and descriptive links.</p><div class="av-intel-actions"><button class="av-intel-action" id="avAccessRun">Recheck article</button></div><div id="avAccessResult"></div>';$('avAccessRun').onclick=accessResults;accessResults();}
  else if(active==='brief'){body.innerHTML=`<h3>AI Content Brief Generator</h3><p>Prepare an editorial plan for human review. This does not research live SERPs or competitors.</p><div class="av-intel-controls"><label>Content topic<input maxlength="300" id="avBriefTopic" placeholder="Example: SEO for local businesses"></label><label>Audience and content goals<textarea maxlength="1500" rows="3" id="avBriefNotes" placeholder="Audience, key questions and constraints"></textarea></label></div><div class="av-intel-actions"><button class="av-intel-action" id="avBriefGenerate">Generate brief with AI</button><button class="av-intel-action secondary" id="avBriefCopy" hidden>Copy brief</button></div><p id="avIntelStatus" role="status"></p><div id="avBriefResult" class="av-intel-output" style="white-space:pre-wrap">No brief generated yet.</div>`;$('avBriefTopic').value=$('metaTitle')?.value||'';$('avBriefGenerate').onclick=generateBrief;$('avBriefCopy').onclick=()=>navigator.clipboard?.writeText(lastBrief).then(()=>status('Brief copied.')).catch(()=>status('Clipboard unavailable.'));}
  else {body.innerHTML='<h3>Content Refresh Assistant</h3><p>Locate time-sensitive passages and review them. To request an AI rewrite, select text in the editor and choose Refresh selected content in the existing Ask AI dialog.</p><div class="av-intel-actions"><button class="av-intel-action" id="avRefreshRun">Find refresh candidates</button><button class="av-intel-action secondary" id="avRefreshAI">Open AI refresh</button></div><div id="avRefreshResult"></div>';$('avRefreshRun').onclick=refreshResults;$('avRefreshAI').onclick=()=>{dialog.close();$('aiTask').value='refresh';$('aiDialog').showModal();};refreshResults();}
 }
 // Public testing hook for the additive panel only.
 window.AmpliVerifyIntelligence={open:launch};
})();
