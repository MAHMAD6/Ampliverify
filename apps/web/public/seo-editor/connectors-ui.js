/* Connector UI: backend integration only. Does not put any CMS credentials in localStorage. */
(()=>{
  const $=id=>document.getElementById(id);
  const providerLabels={wordpress:'WordPress',shopify:'Shopify',webflow:'Webflow',ghost:'Ghost',drupal:'Drupal',joomla:'Joomla',strapi:'Strapi',custom:'Custom API'};
  const fields={
    wordpress:['site','username','token'],shopify:['shop','token','blog_id','author'],
    webflow:['token','collection_id','body_field','description_field'],ghost:['site','token','updated_at'],
    drupal:['site','token','bundle','text_format'],joomla:['site','token','category_id'],
    strapi:['site','token','collection','title_field','body_field','slug_field'],custom:['endpoint','token']
  };
  const hints={site:'HTTPS website URL (e.g. https://example.com)',token:'CMS API token / application password / Admin API key',shop:'store.myshopify.com',blog_id:'gid://shopify/Blog/123456',author:'Article author name',collection_id:'CMS collection ID',body_field:'Webflow rich-text field slug; defaults post-body',description_field:'Optional meta description field slug',updated_at:'Ghost existing post updated_at (required for edit)',bundle:'Drupal content bundle, e.g. article',text_format:'Drupal text format e.g. basic_html',category_id:'Joomla content category ID',collection:'Strapi plural API ID, e.g. articles',title_field:'Title field name',slug_field:'Optional slug field name',endpoint:'HTTPS API endpoint for JSON POST',username:'WordPress username'};
  const defaults={body_field:'post-body',bundle:'article',text_format:'basic_html',title_field:'title'};
  let connections=[];
  const safeText=(el,s)=>el.textContent=String(s||'');
  const result=(id,s)=>safeText($(id),s);
  const workspace=()=>{const value=$('workspaceId').value.trim();if(!/^[a-zA-Z0-9_-]{3,100}$/.test(value))throw Error('Enter a valid workspace ID.');return encodeURIComponent(value);};
  const base=()=>'/api/workspaces/'+workspace();
  const backend=()=>{const x=$('backendUrl').value.trim().replace(/\/$/,'');if(!(/^https:\/\/[^/]+$/.test(x)||/^http:\/\/(localhost|127\.0\.0\.1):3000$/.test(x)))throw Error('Use HTTPS; HTTP is permitted only for local development.');return x;};
  async function api(path,method='GET',body){
    const token=globalThis.AMPLIVERIFY_ACCESS_TOKEN || $('backendKey').value.trim();
    if(!token)throw Error('Sign in through AmpliVerify or enter a developer JWT for local testing.');
    let response;
    try{response=await fetch(backend()+path,{method,headers:{'Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});}
    catch(e){throw Error('Connector backend unavailable. Check the API address, CORS configuration, and HTTPS certificate.');}
    let data;try{data=await response.json();}catch(e){throw Error('Backend returned invalid JSON');}
    if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Request failed (HTTP '+response.status+')');
    return data;
  }
  function renderFields(){
    const platform=$('providerSelect').value;
    $('providerFields').replaceChildren();
    for(const field of fields[platform]){
      const label=document.createElement('label');label.className='connector-label';label.textContent=field.replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
      const input=document.createElement('input');input.name=field;input.type=field==='token'?'password':'text';input.placeholder=hints[field]||'';
      input.value=defaults[field]||'';input.autocomplete='off';input.required=field==='token'||(['site','shop','blog_id','author','collection_id','category_id','collection','endpoint','username'].includes(field)&&fields[platform].includes(field));
      label.append(input);$('providerFields').append(label);
    }
  }
  function renderConnections(){
    $('connectionList').replaceChildren();$('publishDestination').replaceChildren(new Option('Choose a connected CMS…',''));
    if(!connections.length){const p=document.createElement('p');p.textContent='No connections configured yet.';$('connectionList').append(p);}
    for(const c of connections){
      const row=document.createElement('div');row.className='connection-row';
      const label=document.createElement('span');label.textContent=`${c.name} · ${providerLabels[c.provider]}`;
      const del=document.createElement('button');del.type='button';del.className='button ghost';del.textContent='Disconnect';del.onclick=async()=>{
        if(!confirm('Disconnect '+c.name+'? This removes its saved credentials, not published posts.'))return;
        try{await api(base()+'/connections/'+encodeURIComponent(c.id),'DELETE');await refresh();result('connectionResult','Destination disconnected.');}catch(e){result('connectionResult',e.message);}
      };row.append(label,del);$('connectionList').append(row);
      $('publishDestination').add(new Option(`${c.name} — ${providerLabels[c.provider]}`,c.id));
    }
  }
  async function refresh(){connections=await api(base()+'/connections');renderConnections();result('connectionResult',`${connections.length} destination(s) available.`);}
  for(const p in fields)$('providerSelect').add(new Option(providerLabels[p],p));
  $('providerSelect').onchange=renderFields;renderFields();
  $('connectorsBtn').onclick=()=>{$('connectorDialog').showModal();if(globalThis.AMPLIVERIFY_TOKEN?.()||globalThis.AMPLIVERIFY_ACCESS_TOKEN||$('backendKey').value)refresh().catch(e=>result('connectionResult',e.message));};
  $('openConnectFromPublish').onclick=()=>{$('publishDialog').close();$('connectorsBtn').click();};
  $('closeConnections').onclick=()=>$('connectorDialog').close();
  $('closePublishDialog').onclick=()=>$('publishDialog').close();
  $('refreshConnections').onclick=()=>refresh().catch(e=>result('connectionResult',e.message));
  $('newConnectionForm').onsubmit=async e=>{
    e.preventDefault();const config={};for(const input of $('providerFields').querySelectorAll('input'))if(input.value.trim())config[input.name]=input.value.trim();
    try{await api(base()+'/connections','POST',{provider:$('providerSelect').value,name:$('connectionName').value.trim(),config});
      $('newConnectionForm').reset();renderFields();await refresh();result('connectionResult','Connection saved with server-side credential encryption. Live CMS authorization remains unverified.');
    }catch(error){result('connectionResult',error.message);}
  };
  $('publishBtn').addEventListener('click',()=>{if(globalThis.AMPLIVERIFY_TOKEN?.()||globalThis.AMPLIVERIFY_ACCESS_TOKEN||$('backendKey').value)refresh().catch(e=>result('publishResult',e.message));});
  const articleKey=()=>{const k='ampliverify:editor:article-key';let id=localStorage.getItem(k);if(!id){id=crypto.randomUUID();localStorage.setItem(k,id);}return id;};
  const content=()=>{
    const article=$('article');let html=article.innerHTML;
    // Remove editor-only controls from exported/published HTML; author must sanitize on the production backend.
    const node=article.cloneNode(true);node.querySelectorAll('.remove-media').forEach(el=>el.remove());
    html=node.innerHTML;
    return {article_key:articleKey(),title:article.querySelector('h1')?.textContent?.trim()||$('metaTitle').value||'Untitled article',html,
      description:$('metaDescription').value};
  };
  $('exportHtml').onclick=()=>{
    const data=content();const blob=new Blob(['<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+data.title.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</title></head><body>'+data.html+'</body></html>'],{type:'text/html'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ampliverify-article.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);result('publishResult','HTML exported.');
  };
  $('copyHtml').onclick=async()=>{try{await navigator.clipboard.writeText(content().html);result('publishResult','Article HTML copied.');}catch(e){result('publishResult','Clipboard requires localhost or HTTPS. Use Export HTML instead.');}};
  async function submit(status){
    if($('article').querySelector('.av-form-block:not([data-form-status="active"])')){result('publishResult','This article contains offline form drafts. Activate each form before CMS publishing, or remove those blocks.');return;}
    const id=$('publishDestination').value;
    if(!id){result('publishResult','Select a destination or add a connection first.');return;}
    const c=connections.find(x=>x.id===id);
    if(status==='publish'&&!confirm(`Publish this article LIVE to ${c?.name || 'the selected CMS'}?`))return;
    const button=$(status==='publish'?'externalPublishBtn':'externalDraftBtn');button.disabled=true;result('publishResult',status==='publish'?'Publishing…':'Creating CMS draft…');
    try{const data=await api(`${base()}/connections/${encodeURIComponent(id)}/publish`,'POST',{...content(),status});
      result('publishResult',`CMS response: ${data.state||'submitted'}. External ID: ${data.id||'(not returned)'}. ${data.url||''}`);
      $('externalArticleId').value=data.id||''; // UI-only; server retains authoritative external ID mapping.
    }catch(err){result('publishResult','Publishing failed: '+err.message);}finally{button.disabled=false;}
  }
  $('externalDraftBtn').onclick=()=>submit('draft');$('externalPublishBtn').onclick=()=>submit('publish');
})();
