export type SectionKind = 'hero' | 'h1' | 'h2';
export type Section = { id: string; kind: SectionKind; title: string; hint: string; body: string; cta?: string };

let seq = 0;
export const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Starting outline for a new article. Placeholders only — no content is pre-written. */
export function starterOutline(): Section[] {
  const h2 = (title: string, hint: string): Section => ({ id: newId(), kind: 'h2', title: '', hint: `${title} — ${hint}`, body: '' });
  return [
    { id: newId(), kind: 'hero', title: '', hint: 'Featured image, headline, CTA', body: '', cta: '' },
    { id: newId(), kind: 'h1', title: '', hint: 'Main title of the page', body: '' },
    h2('Introduction', 'Overview and key points'),
    h2('Key Benefits', 'Main benefits and value'),
    h2('How It Works', 'Step-by-step process'),
    h2('Best Practices', 'Tips for success'),
    h2('Common Challenges and How to Overcome', 'Obstacles and solutions'),
    h2('Future Trends', 'What to expect'),
    h2('Conclusion', 'Summary and next steps'),
    h2('FAQs', 'Frequently asked questions'),
  ];
}

export function sectionLabel(s: Section) {
  if (s.kind === 'hero') return 'Hero Section';
  if (s.title.trim()) return s.title.trim();
  return s.kind === 'h1' ? 'Article Title' : s.hint.split(' — ')[0];
}

export function sectionHint(s: Section) {
  return s.kind === 'hero' ? s.hint : s.hint.includes(' — ') ? s.hint.split(' — ')[1] : s.hint;
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Minimal markdown → HTML for the body text (bold, italic, links, bullet and numbered lists, quotes). */
function inline(text: string) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

export function bodyToHtml(body: string) {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`  <li>${inline((bullet ?? numbered)![1])}</li>`);
      continue;
    }
    close();
    if (!line.trim()) continue;
    const quote = /^>\s?(.*)$/.exec(line);
    out.push(quote ? `<blockquote>${inline(quote[1])}</blockquote>` : `<p>${inline(line)}</p>`);
  }
  close();
  return out.join('\n');
}

export function documentToHtml(sections: Section[]) {
  const parts: string[] = [];
  for (const s of sections) {
    if (s.kind === 'hero') {
      if (s.title || s.body || s.cta) {
        parts.push('<header class="hero">');
        if (s.title) parts.push(`  <p class="hero-title">${esc(s.title)}</p>`);
        if (s.body) parts.push(`  <p class="hero-subtitle">${esc(s.body)}</p>`);
        if (s.cta) parts.push(`  <a class="cta">${esc(s.cta)}</a>`);
        parts.push('</header>');
      }
    } else if (s.kind === 'h1') {
      if (s.title) parts.push(`<h1>${esc(s.title)}</h1>`);
      if (s.body) parts.push(bodyToHtml(s.body));
    } else {
      if (s.title) parts.push(`<h2>${esc(s.title)}</h2>`);
      if (s.body) parts.push(bodyToHtml(s.body));
    }
  }
  return parts.join('\n') || '<!-- Start writing to generate HTML -->';
}
