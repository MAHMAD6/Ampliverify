/* AmpliVerify V13 — NestJS bridge. No changes to the visual design.
 * In production, the host application injects AMPLIVERIFY_CONTEXT from its
 * authenticated runtime; never persist access tokens to localStorage.
 * AmpliVerify host: the page is served at /app/seo-editor and calls the
 * same-origin /api/workspaces proxy, which adds the signed-in user's token on
 * the server. `accessToken` is only the marker 'session'; no token reaches
 * the browser.
 */
(()=>{
 'use strict';
 const ctx=globalThis.AMPLIVERIFY_CONTEXT;
 const api=document.getElementById('backendUrl'),ws=document.getElementById('workspaceId'),key=document.getElementById('backendKey');
 if(ctx){
  if(ctx.apiBaseUrl){const origin=new URL(ctx.apiBaseUrl,location.origin);if(location.protocol==='https:'&&origin.protocol!=='https:')throw Error('The API must use HTTPS');api.value=origin.origin;}
  if(ctx.workspaceId)ws.value=ctx.workspaceId;
  if(ctx.accessToken)globalThis.AMPLIVERIFY_ACCESS_TOKEN=ctx.accessToken;
  if(ctx.production){const settings=document.querySelector('.connector-settings');if(settings){for(const label of settings.querySelectorAll('label'))label.hidden=true;}if(key)key.value='';}
  // Article keys are scoped per workspace; ?article=<key> opens a specific cloud draft.
  if(ctx.workspaceId){
   const scoped='ampliverify:editor:article-key:'+ctx.workspaceId;
   let id=ctx.articleKey||localStorage.getItem(scoped);
   if(!id||!/^[a-zA-Z0-9_-]{3,100}$/.test(id))id=crypto.randomUUID();
   localStorage.setItem(scoped,id);localStorage.setItem('ampliverify:editor:article-key',id);
  }
 }else if(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.protocol==='file:'){
  api.value='http://127.0.0.1:3000';
 }
 globalThis.AMPLIVERIFY_API_BASE=()=>api.value.trim().replace(/\/$/,'');
 globalThis.AMPLIVERIFY_ACTIVE_WORKSPACE=()=>ws.value.trim();
 globalThis.AMPLIVERIFY_TOKEN=()=>globalThis.AMPLIVERIFY_ACCESS_TOKEN||key.value.trim();
})();
