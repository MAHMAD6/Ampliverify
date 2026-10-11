/** API media URLs (`/api/v1/public/media/:id`) are served from the web origin at `/media/:id`. */
export function webMediaUrl(url: string | null | undefined) {
  if (!url) return '';
  const m = /^\/api\/v1\/public\/media\/([0-9a-f-]{36})$/i.exec(url);
  return m ? `/media/${m[1]}` : url;
}

/**
 * Embeddable video for a URL: YouTube (privacy-enhanced), Vimeo, or a Media
 * Library upload. Anything else is not embedded.
 */
export function videoEmbed(raw: string): { kind: 'iframe' | 'video'; src: string } | null {
  const url = webMediaUrl(raw.trim());
  if (/^\/media\/[0-9a-f-]{36}$/i.test(url)) return { kind: 'video', src: url };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const id = (v: string | null | undefined) => (v && /^[\w-]{6,20}$/.test(v) ? v : null);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = id(u.searchParams.get('v')) ?? id(u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1]);
    return v ? { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${v}` } : null;
  }
  if (host === 'youtu.be') {
    const v = id(u.pathname.slice(1));
    return v ? { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${v}` } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = u.pathname.match(/(\d{6,12})/)?.[1];
    return v ? { kind: 'iframe', src: `https://player.vimeo.com/video/${v}` } : null;
  }
  return null;
}
