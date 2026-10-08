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
    .replace(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1">')
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
    const sub = /^(#{3,4})\s+(.*)$/.exec(line);
    if (sub) {
      out.push(`<h${sub[1].length}>${inline(sub[2])}</h${sub[1].length}>`);
      continue;
    }
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

/** Inline HTML back to the editor's markdown subset. */
function toMarkdown(node: Node): string {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      out += (n.textContent ?? '').replace(/\s+/g, ' ');
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const inner = toMarkdown(el);
    switch (el.tagName.toLowerCase()) {
      case 'strong':
      case 'b':
        out += inner.trim() ? `**${inner.trim()}**` : '';
        break;
      case 'em':
      case 'i':
        out += inner.trim() ? `*${inner.trim()}*` : '';
        break;
      case 'u':
        out += inner.trim() ? `__${inner.trim()}__` : '';
        break;
      case 'a': {
        const href = el.getAttribute('href') ?? '';
        out += /^https?:\/\//.test(href) ? `[${inner.trim() || href}](${href})` : inner;
        break;
      }
      case 'img': {
        const src = el.getAttribute('src') ?? '';
        if (/^https?:\/\//.test(src)) out += `![${el.getAttribute('alt') ?? ''}](${src})`;
        break;
      }
      case 'br':
        out += ' ';
        break;
      default:
        out += inner;
    }
  });
  return out;
}

/** Block-level HTML to body lines (paragraphs, lists, quotes, H3/H4). */
function blockToBody(el: Element): string[] {
  const tag = el.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') return Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li').map((li, i) => `${tag === 'ul' ? '-' : `${i + 1}.`} ${toMarkdown(li).trim()}`);
  if (tag === 'blockquote') return [`> ${toMarkdown(el).trim()}`];
  if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return [`${tag === 'h3' ? '###' : '####'} ${toMarkdown(el).trim()}`];
  if (tag === 'p' || tag === 'figure' || tag === 'figcaption') {
    const text = toMarkdown(el).trim();
    return text ? [text] : [];
  }
  if (['div', 'section', 'article', 'main', 'header', 'span', 'table', 'tbody', 'tr', 'td', 'th'].includes(tag)) {
    const hasBlocks = Array.from(el.children).some((c) => /^(p|ul|ol|blockquote|h[1-6]|div|section|figure|table)$/i.test(c.tagName));
    if (!hasBlocks) {
      const text = toMarkdown(el).trim();
      return text ? [text] : [];
    }
    return Array.from(el.children).flatMap(blockToBody);
  }
  const text = toMarkdown(el).trim();
  return text ? [text] : [];
}

/**
 * Parses saved/imported HTML into editor sections: the first H1 is the
 * article title, each H2 starts a section, everything else becomes body
 * text. Browser-only (DOMParser).
 */
export function htmlToSections(html: string): Section[] {
  if (!html.trim()) return starterOutline();
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const hero: Section = { id: newId(), kind: 'hero', title: '', hint: 'Featured image, headline, CTA', body: '', cta: '' };
  const h1: Section = { id: newId(), kind: 'h1', title: '', hint: 'Main title of the page', body: '' };
  const sections: Section[] = [hero, h1];
  let current: Section = h1;
  const heroEl = doc.querySelector('header.hero');
  if (heroEl) {
    hero.title = heroEl.querySelector('.hero-title')?.textContent?.trim() ?? '';
    hero.body = heroEl.querySelector('.hero-subtitle')?.textContent?.trim() ?? '';
    hero.cta = heroEl.querySelector('.cta')?.textContent?.trim() ?? '';
    heroEl.remove();
  }
  const visit = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1' && !h1.title) {
      h1.title = el.textContent?.trim() ?? '';
      current = h1;
    } else if (tag === 'h1' || tag === 'h2') {
      current = { id: newId(), kind: 'h2', title: el.textContent?.trim() ?? '', hint: 'Section — Add content', body: '' };
      sections.push(current);
    } else if (['div', 'section', 'article', 'main'].includes(tag) && el.querySelector('h1,h2')) {
      Array.from(el.children).forEach(visit);
    } else {
      const lines = blockToBody(el);
      if (lines.length) current.body = [current.body, ...lines].filter(Boolean).join('\n');
    }
  };
  Array.from(doc.body.children).forEach(visit);
  return sections;
}
