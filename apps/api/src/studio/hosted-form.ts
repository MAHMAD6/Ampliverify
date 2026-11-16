import type { FormSchema, FormStyle } from './studio.security';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Content-Security-Policy of the hosted form page (embeddable on customer sites, FORM_FRAME_ANCESTORS). */
export function hostedFormCsp(origin: string) {
  const ancestors = process.env.FORM_FRAME_ANCESTORS || "'self' https:";
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'unsafe-inline'",
    `connect-src 'self' ${origin}`,
    "frame-src https://challenges.cloudflare.com",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${ancestors}`,
  ].join('; ');
}

/**
 * Standalone, brand-neutral hosted form (V13 hosted-form.ts) honoring the
 * activated style: colors, font, size, spacing, radius, width (30–100 %) and
 * height (auto or 160–1200 px, scrolling inside the frame).
 */
export function hostedFormPage(id: string, schema: FormSchema, style: FormStyle, submitPath: string) {
  const inherit = style.mode === 'inherit';
  const font = style.font === 'inherit' ? 'system-ui, Arial, sans-serif' : style.font;
  const bg = inherit ? 'transparent' : style.background;
  const height = style.height ? `height:${style.height}px;overflow:auto;` : '';
  const fields = schema.fields
    .map((f) => {
      const key = esc(f.key);
      const req = f.required ? ' required' : '';
      const input =
        f.kind === 'textarea'
          ? `<textarea name="${key}" maxlength="2000"${req}></textarea>`
          : f.kind === 'select'
            ? `<select name="${key}"${req}><option value="">Choose…</option>${f.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`
            : f.kind === 'checkbox'
              ? `<input type="checkbox" name="${key}" value="true"${req}>`
              : `<input type="${f.kind}" name="${key}" maxlength="2000"${req}>`;
      return f.kind === 'checkbox' ? `<label class="check">${input}<span>${esc(f.label)}${f.required ? ' *' : ''}</span></label>` : `<label>${esc(f.label)}${f.required ? ' *' : ''}${input}</label>`;
    })
    .join('');
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const turnstile = siteKey ? `<div class="cf-turnstile" data-sitekey="${esc(siteKey)}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : '';
  const privacy = schema.privacy_url ? `<p class="fine"><a href="${esc(schema.privacy_url)}" target="_blank" rel="noopener noreferrer">Privacy notice</a></p>` : '';
  const consent = schema.consent_required ? '<label class="check"><input name="consent" type="checkbox" required><span>I consent to the use of the information I submit.</span></label>' : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(schema.name)}</title><style>
:root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;background:${bg}}
body{padding:12px;color:${style.text};font:${style.fontSize}px/1.5 ${font}}
main{width:${style.width}%;max-width:100%;margin:0 auto;${height}background:${bg};border:${inherit ? '0' : `1px solid ${style.border}`};border-radius:${style.radius}px;padding:${inherit ? 0 : 16}px}
form{display:grid;gap:${style.spacing}px}h1{font-size:1.35em;margin:0 0 6px}p{margin:0 0 ${style.spacing}px}
label{display:grid;gap:5px}label.check{display:flex;gap:8px;align-items:flex-start}
input:not([type=checkbox]),textarea,select{width:100%;border:1px solid ${style.border};border-radius:${style.radius}px;padding:10px;background:#fff;color:#243144;font:inherit}
input:focus,textarea:focus,select:focus{outline:2px solid ${style.accent};outline-offset:1px}textarea{min-height:96px}
button{justify-self:start;border:0;border-radius:${style.radius}px;background:${style.button};color:${style.buttonText};padding:11px 18px;cursor:pointer;font:inherit}
button:disabled{opacity:.55}.fine{font-size:.85em}a{color:${style.accent}}#status{min-height:1.5em;margin:0}
</style></head><body><main><h1>${esc(schema.name)}</h1>${schema.description ? `<p>${esc(schema.description)}</p>` : ''}<form id="form" novalidate>${fields}${consent}${turnstile}${privacy}<button type="submit">${esc(schema.submit_label)}</button><p id="status" role="status" aria-live="polite"></p></form></main><script>
(function(){var f=document.getElementById('form'),s=document.getElementById('status');
f.addEventListener('submit',function(e){e.preventDefault();if(!f.reportValidity())return;var b=f.querySelector('button');b.disabled=true;s.textContent='Sending…';
var d=new FormData(f),values={};d.forEach(function(v,k){if(k==='consent'||k==='cf-turnstile-response')return;values[k]=v==='true'?true:v;});
fetch(${JSON.stringify(submitPath)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:values,consent:d.get('consent')==='on',turnstile_token:d.get('cf-turnstile-response')||''})})
.then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.detail||'The form could not be sent. Please try again.');s.textContent=j.message||'Thank you';f.reset();});})
.catch(function(err){s.textContent=err.message;}).finally(function(){b.disabled=false;if(window.turnstile)window.turnstile.reset();});});})();
</script></body></html>`;
}
