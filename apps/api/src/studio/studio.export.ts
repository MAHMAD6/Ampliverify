import { BadRequestException } from '@nestjs/common';
import { load, type CheerioAPI } from 'cheerio';
import PDFDocument from 'pdfkit';
import { deflateRawSync } from 'zlib';

/**
 * Article exports (V13.2 guide §11): the sanitized article is parsed into a
 * canonical block model, then rendered per format. Media is embedded only
 * when it is approved workspace media the server holds; anything else stays a
 * link and is reported in the output.
 */

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean; href?: string };
export type Block =
  | { type: 'heading'; level: number; runs: Run[] }
  | { type: 'paragraph'; runs: Run[] }
  | { type: 'quote'; runs: Run[] }
  | { type: 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: Run[][] }
  | { type: 'image'; src: string; alt: string; caption: string }
  | { type: 'video'; src: string; poster: string; caption: string }
  | { type: 'form'; url: string; name: string }
  | { type: 'table'; rows: Run[][][] }
  | { type: 'hr' };

export type MediaFile = { bytes: Buffer; mime: string; width: number | null; height: number | null; name: string };
export type ExportInput = { title: string; html: string; description: string; keyword: string; includeSeo: boolean; media: Map<string, MediaFile>; includeMedia: boolean };
export const EXPORT_FORMATS = ['html', 'txt', 'md', 'json', 'docx', 'pdf', 'zip'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'figure', 'table', 'hr', 'img', 'video', 'iframe', 'div', 'section', 'article', 'header', 'footer', 'aside']);

type El = { tagName?: string; name?: string; type?: string; data?: string; attribs?: Record<string, string>; children?: El[] };
const tagOf = (n: El) => (n.tagName ?? n.name ?? '').toLowerCase();

function runsOf(nodes: El[], style: Omit<Run, 'text'> = {}): Run[] {
  const out: Run[] = [];
  for (const n of nodes) {
    if (n.type === 'text') {
      const text = (n.data ?? '').replace(/\s+/g, ' ');
      if (text) out.push({ text, ...style });
      continue;
    }
    const t = tagOf(n);
    if (t === 'br') out.push({ text: '\n', ...style });
    else if (t === 'img' || t === 'video' || t === 'iframe') continue;
    else {
      const next = { ...style };
      if (t === 'b' || t === 'strong') next.bold = true;
      if (t === 'i' || t === 'em' || t === 'cite') next.italic = true;
      if (t === 'u' || t === 'ins') next.underline = true;
      if (t === 's' || t === 'del' || t === 'strike') next.strike = true;
      if (t === 'code') next.code = true;
      if (t === 'a' && n.attribs?.href && /^(https?:|mailto:)/i.test(n.attribs.href)) next.href = n.attribs.href;
      out.push(...runsOf(n.children ?? [], next));
    }
  }
  return out;
}

const plainOf = (runs: Run[]) => runs.map((r) => r.text).join('').replace(/[ \t]+\n/g, '\n').trim();

export function toBlocks(html: string): Block[] {
  const $ = load(html, null, false);
  const blocks: Block[] = [];
  const q = (n: El) => $(n as never);
  const walk = (nodes: El[]) => {
    let inline: El[] = [];
    const flush = () => {
      const runs = runsOf(inline);
      if (plainOf(runs)) blocks.push({ type: 'paragraph', runs });
      inline = [];
    };
    for (const n of nodes) {
      const t = tagOf(n);
      if (n.type === 'text' || (n.type === 'tag' && !BLOCK_TAGS.has(t))) {
        inline.push(n);
        continue;
      }
      if (n.type !== 'tag') continue;
      flush();
      const kids = n.children ?? [];
      if (/^h[1-6]$/.test(t)) blocks.push({ type: 'heading', level: Number(t[1]), runs: runsOf(kids) });
      else if (t === 'p') {
        const media = q(n).find('img,video,iframe').toArray() as unknown as El[];
        const runs = runsOf(kids);
        if (plainOf(runs)) blocks.push({ type: 'paragraph', runs });
        for (const m of media) mediaBlock(m, '');
      } else if (t === 'ul' || t === 'ol') {
        const items = kids.filter((k) => tagOf(k) === 'li').map((li) => runsOf(li.children ?? []));
        if (items.length) blocks.push({ type: 'list', ordered: t === 'ol', items });
      } else if (t === 'blockquote') blocks.push({ type: 'quote', runs: runsOf(kids) });
      else if (t === 'pre') blocks.push({ type: 'code', text: q(n).text() });
      else if (t === 'hr') blocks.push({ type: 'hr' });
      else if (t === 'table') {
        const rows = (q(n).find('tr').toArray() as unknown as El[]).map((tr) => (tr.children ?? []).filter((c) => ['td', 'th'].includes(tagOf(c))).map((c) => runsOf(c.children ?? [])));
        if (rows.length) blocks.push({ type: 'table', rows });
      } else if (t === 'img' || t === 'video' || t === 'iframe') mediaBlock(n, '');
      else if (t === 'figure') {
        const caption = q(n).find('figcaption').first().text().trim();
        const iframe = q(n).find('iframe').first();
        const media = q(n).find('img,video').first();
        if (iframe.length && /\/forms\/public\//.test(iframe.attr('src') ?? '')) blocks.push({ type: 'form', url: iframe.attr('src')!, name: iframe.attr('title') ?? 'Form' });
        else if (media.length || iframe.length) mediaBlock((media[0] ?? iframe[0]) as unknown as El, caption);
        else walk(kids);
      } else if (q(n).hasClass('av-form-block')) {
        const url = q(n).attr('data-form-url') ?? q(n).find('iframe').attr('src') ?? '';
        if (url) blocks.push({ type: 'form', url, name: q(n).find('iframe').attr('title') ?? 'Form' });
      } else walk(kids);
    }
    flush();
  };
  const mediaBlock = (n: El, caption: string) => {
    const t = tagOf(n);
    const a = n.attribs ?? {};
    if (t === 'img' && a.src) blocks.push({ type: 'image', src: a.src, alt: a.alt ?? '', caption });
    else if (t === 'video') {
      const src = a.src ?? ((n.children ?? []).find((c) => tagOf(c) === 'source')?.attribs?.src ?? '');
      if (src) blocks.push({ type: 'video', src, poster: a.poster ?? '', caption });
    } else if (t === 'iframe' && a.src) {
      if (/\/forms\/public\//.test(a.src)) blocks.push({ type: 'form', url: a.src, name: a.title ?? 'Form' });
      else blocks.push({ type: 'video', src: a.src, poster: '', caption });
    }
  };
  walk(($.root()[0] as unknown as El).children ?? []);
  return blocks;
}

// ── Text formats ────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function mdRuns(runs: Run[]) {
  return runs
    .map((r) => {
      let t = r.text.replace(/([\\`*_[\]])/g, '\\$1');
      if (!t.trim()) return t;
      if (r.code) t = `\`${r.text}\``;
      if (r.bold) t = `**${t}**`;
      if (r.italic) t = `*${t}*`;
      if (r.strike) t = `~~${t}~~`;
      if (r.underline) t = `<u>${t}</u>`;
      if (r.href) t = `[${t}](${r.href})`;
      return t;
    })
    .join('')
    .trim();
}

export function toMarkdown(blocks: Block[]) {
  return (
    blocks
      .map((b) => {
        switch (b.type) {
          case 'heading':
            return `${'#'.repeat(b.level)} ${mdRuns(b.runs)}`;
          case 'paragraph':
            return mdRuns(b.runs);
          case 'quote':
            return `> ${mdRuns(b.runs)}`;
          case 'code':
            return `\`\`\`\n${b.text}\n\`\`\``;
          case 'list':
            return b.items.map((i, n) => `${b.ordered ? `${n + 1}.` : '-'} ${mdRuns(i)}`).join('\n');
          case 'image':
            return `![${b.alt}](${b.src})${b.caption ? `\n*${b.caption}*` : ''}`;
          case 'video':
            return `[Video${b.caption ? `: ${b.caption}` : ''}](${b.src})`;
          case 'form':
            return `[${b.name} (form)](${b.url})`;
          case 'table':
            return b.rows.map((r, i) => `| ${r.map(mdRuns).join(' | ')} |${i === 0 ? `\n|${r.map(() => ' --- |').join('')}` : ''}`).join('\n');
          case 'hr':
            return '---';
        }
      })
      .filter(Boolean)
      .join('\n\n') + '\n'
  );
}

export function toText(blocks: Block[]) {
  return (
    blocks
      .map((b) => {
        switch (b.type) {
          case 'heading':
          case 'paragraph':
          case 'quote':
            return plainOf(b.runs);
          case 'code':
            return b.text;
          case 'list':
            return b.items.map((i, n) => `${b.ordered ? `${n + 1}.` : '•'} ${plainOf(i)}`).join('\n');
          case 'image':
            return `[Image: ${b.alt || b.caption || b.src}]`;
          case 'video':
            return `[Video: ${b.src}]`;
          case 'form':
            return `[Form: ${b.url}]`;
          case 'table':
            return b.rows.map((r) => r.map(plainOf).join('\t')).join('\n');
          case 'hr':
            return '----';
        }
      })
      .filter(Boolean)
      .join('\n\n') + '\n'
  );
}

const CSS = `*{box-sizing:border-box}body{margin:0;font:17px/1.7 system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#143047;background:#fff}
main{max-width:820px;margin:0 auto;padding:32px 20px}h1,h2,h3,h4,h5,h6{line-height:1.25;color:#062e35;margin:1.6em 0 .5em}h1{font-size:2.2em;margin-top:0}
p,ul,ol,blockquote,table,figure{margin:0 0 1.1em}img,video,iframe{max-width:100%;height:auto;border:0}figure{margin:1.6em 0}figcaption{font-size:.88em;color:#5b7480;margin-top:6px}
blockquote{border-left:4px solid #0f766e;padding:.2em 1em;color:#334155;background:#f8fafc}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}
td,th{border:1px solid #d6dee6;padding:8px 10px;text-align:left}pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;overflow:auto}a{color:#0f766e}
iframe{width:100%;aspect-ratio:16/9}.av-hosted-form iframe{aspect-ratio:auto;min-height:420px}@media(max-width:600px){body{font-size:16px}main{padding:20px 16px}h1{font-size:1.8em}}`;

export function htmlDocument(input: Pick<ExportInput, 'title' | 'description' | 'keyword' | 'includeSeo'>, body: string, cssHref?: string) {
  const meta = input.includeSeo && input.description ? `<meta name="description" content="${esc(input.description)}">` : '';
  const style = cssHref ? `<link rel="stylesheet" href="${cssHref}">` : `<style>${CSS}</style>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.title)}</title>${meta}${style}</head><body><main><article>${body}</article></main></body></html>`;
}

// ── ZIP (deflate) ───────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const MAX_ZIP_BYTES = 300 * 1024 * 1024;

export function zip(entries: { name: string; data: Buffer | string }[]) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const data = typeof e.data === 'string' ? Buffer.from(e.data, 'utf8') : e.data;
    const name = Buffer.from(e.name, 'utf8');
    const compressed = /\.(png|jpe?g|gif|webp|mp4|webm|zip)$/i.test(e.name) ? data : deflateRawSync(data);
    const method = compressed === data ? 0 : 8;
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(method, 8);
    head.writeUInt32LE(0x00210000, 10); // 1980-01-01 00:00
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(compressed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(0x00210000, 12);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(compressed.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(head, name, compressed);
    central.push(cen, name);
    offset += 30 + name.length + compressed.length;
    if (offset > MAX_ZIP_BYTES) throw new BadRequestException({ code: 'EXPORT_TOO_LARGE', message: 'The export is too large.' });
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cenBuf, end]);
}

// ── DOCX (WordprocessingML) ─────────────────────────────────────────────────

const x = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function docx(title: string, blocks: Block[], media: Map<string, MediaFile>) {
  const rels: string[] = [];
  const images: { name: string; data: Buffer }[] = [];
  let relId = 10;
  const link = (href: string) => {
    const id = `rId${relId++}`;
    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(href)}" TargetMode="External"/>`);
    return id;
  };
  const run = (r: Run) => {
    const props = `${r.bold ? '<w:b/>' : ''}${r.italic ? '<w:i/>' : ''}${r.underline || r.href ? '<w:u w:val="single"/>' : ''}${r.strike ? '<w:strike/>' : ''}${r.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : ''}${r.href ? '<w:color w:val="0F766E"/>' : ''}`;
    const parts = r.text.split('\n').map((t, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(t)}</w:t>`).join('');
    const xml = `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${parts}</w:r>`;
    return r.href ? `<w:hyperlink r:id="${link(r.href)}">${xml}</w:hyperlink>` : xml;
  };
  const para = (runs: Run[], style?: string, extra = '') => `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${runs.map(run).join('')}</w:p>`;
  const image = (file: MediaFile, alt: string, n: number) => {
    const ext = file.mime === 'image/png' ? 'png' : file.mime === 'image/gif' ? 'gif' : 'jpeg';
    const name = `image${n}.${ext}`;
    const id = `rId${relId++}`;
    images.push({ name, data: file.bytes });
    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
    const w = file.width ?? 800;
    const h = file.height ?? 450;
    const cx = Math.round(Math.min(6, w / 96) * 914400);
    const cy = Math.round((cx * h) / w);
    return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="${name}" descr="${x(alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };
  let pic = 1;
  const body = blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return para(b.runs, `Heading${b.level}`);
        case 'paragraph':
          return para(b.runs);
        case 'quote':
          return para(b.runs, 'Quote');
        case 'code':
          return b.text.split('\n').map((l) => para([{ text: l, code: true }])).join('');
        case 'list':
          return b.items.map((i) => para(i, 'ListParagraph', `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${b.ordered ? 2 : 1}"/></w:numPr>`)).join('');
        case 'image': {
          const file = media.get(b.src);
          const caption = b.caption ? para([{ text: b.caption, italic: true }], 'Caption') : '';
          if (file && /^image\/(png|jpeg|gif)$/.test(file.mime)) return image(file, b.alt, pic++) + caption;
          return para([{ text: `[Image: ${b.alt || 'image'}] `, italic: true }, { text: b.src, href: b.src }]) + caption;
        }
        case 'video':
          return para([{ text: 'Video: ', italic: true }, { text: b.src, href: b.src }]) + (b.caption ? para([{ text: b.caption, italic: true }], 'Caption') : '');
        case 'form':
          return para([{ text: `${b.name}: `, italic: true }, { text: b.url, href: b.url }]);
        case 'table':
          return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>${b.rows.map((r) => `<w:tr>${r.map((c) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${para(c)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>${para([])}`;
        case 'hr':
          return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr></w:pPr></w:p>';
      }
    })
    .join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${para([{ text: title }], 'Title')}${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const heading = (n: number, size: number) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="062E35"/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="062E35"/><w:sz w:val="48"/></w:rPr></w:style>${[40, 32, 28, 26, 24, 22].map((s, i) => heading(i + 1, s)).join('')}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="567"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="0F766E"/></w:pBdr></w:pPr><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="5B7480"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D6DEE6"/><w:left w:val="single" w:sz="4" w:color="D6DEE6"/><w:bottom w:val="single" w:sz="4" w:color="D6DEE6"/><w:right w:val="single" w:sz="4" w:color="D6DEE6"/><w:insideH w:val="single" w:sz="4" w:color="D6DEE6"/><w:insideV w:val="single" w:sz="4" w:color="D6DEE6"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels.join('')}</Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(title)}</dc:title><dc:creator>AmpliVerify</dc:creator></cp:coreProperties>`;
  return zip([
    { name: '[Content_Types].xml', data: types },
    { name: '_rels/.rels', data: rootRels },
    { name: 'docProps/core.xml', data: core },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/numbering.xml', data: numbering },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    ...images.map((i) => ({ name: `word/media/${i.name}`, data: i.data })),
  ]);
}

// ── PDF ─────────────────────────────────────────────────────────────────────

function pdf(title: string, blocks: Block[], media: Map<string, MediaFile>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: title, Producer: 'AmpliVerify' } });
    const parts: Buffer[] = [];
    doc.on('data', (b: Buffer) => parts.push(b));
    doc.on('end', () => resolve(Buffer.concat(parts)));
    doc.on('error', reject);
    const width = doc.page.width - 112;
    const font = (r: Run) => (r.code ? 'Courier' : r.bold && r.italic ? 'Helvetica-BoldOblique' : r.bold ? 'Helvetica-Bold' : r.italic ? 'Helvetica-Oblique' : 'Helvetica');
    const write = (runs: Run[], size: number, opts: { indent?: number; prefix?: string; color?: string } = {}) => {
      const list = (opts.prefix ? [{ text: opts.prefix }, ...runs] : runs).filter((r) => r.text);
      if (!list.length) return;
      doc.fontSize(size).fillColor(opts.color ?? '#143047');
      list.forEach((r, i) => {
        doc.font(font(r)).fillColor(r.href ? '#0f766e' : (opts.color ?? '#143047'));
        doc.text(r.text, { continued: i < list.length - 1, link: r.href ?? undefined, underline: !!(r.underline || r.href), strike: !!r.strike, indent: i === 0 ? (opts.indent ?? 0) : 0, width, lineGap: 3 });
      });
      doc.moveDown(0.6);
    };
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#062e35').text(title, { width });
    doc.moveDown(0.8);
    for (const b of blocks) {
      if (b.type === 'heading') {
        doc.moveDown(0.3);
        write(b.runs.map((r) => ({ ...r, bold: true })), [20, 17, 15, 13.5, 12.5, 12][b.level - 1], { color: '#062e35' });
      } else if (b.type === 'paragraph') write(b.runs, 11.5);
      else if (b.type === 'quote') write(b.runs.map((r) => ({ ...r, italic: true })), 11.5, { indent: 18, color: '#334155' });
      else if (b.type === 'code') {
        doc.font('Courier').fontSize(9.5).fillColor('#0f172a').text(b.text, { width });
        doc.moveDown(0.6);
      } else if (b.type === 'list') b.items.forEach((item, i) => write(item, 11.5, { indent: 12, prefix: b.ordered ? `${i + 1}. ` : '• ' }));
      else if (b.type === 'image') {
        const file = media.get(b.src);
        if (file && /^image\/(png|jpeg)$/.test(file.mime)) {
          try {
            doc.image(file.bytes, { fit: [width, 360], align: 'center' });
            doc.moveDown(0.4);
          } catch {
            write([{ text: `[Image: ${b.alt || 'image'}] ` }, { text: b.src, href: b.src }], 10);
          }
        } else write([{ text: `[Image: ${b.alt || 'image'}] `, italic: true }, { text: b.src, href: b.src }], 10);
        if (b.caption) write([{ text: b.caption, italic: true }], 9.5, { color: '#5b7480' });
      } else if (b.type === 'video') write([{ text: 'Video: ', italic: true }, { text: b.src, href: b.src }], 10);
      else if (b.type === 'form') write([{ text: `${b.name}: `, italic: true }, { text: b.url, href: b.url }], 10);
      else if (b.type === 'table') {
        for (const row of b.rows) write([{ text: row.map(plainOf).join('   |   ') }], 10);
      } else if (b.type === 'hr') {
        doc.moveTo(56, doc.y).lineTo(56 + width, doc.y).strokeColor('#cbd5e1').stroke();
        doc.moveDown(0.8);
      }
    }
    doc.end();
  });
}

// ── Entry point ─────────────────────────────────────────────────────────────

const slugName = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'ampliverify-article';

export async function renderExport(format: ExportFormat, input: ExportInput) {
  const blocks = toBlocks(input.html);
  const headings = blocks.filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading').map((h) => ({ level: h.level, text: plainOf(h.runs) }));
  const seo = input.includeSeo ? { title: input.title, description: input.description, primary_keyword: input.keyword } : undefined;
  const name = slugName(input.title);
  const mediaList = blocks.filter((b) => b.type === 'image' || b.type === 'video').map((b) => ({ type: b.type, source: (b as { src: string }).src, packaged: input.media.has((b as { src: string }).src) }));
  switch (format) {
    case 'html':
      return { bytes: Buffer.from(htmlDocument(input, input.html)), ctype: 'text/html; charset=utf-8', name: `${name}.html` };
    case 'txt':
      return { bytes: Buffer.from(toText(blocks)), ctype: 'text/plain; charset=utf-8', name: `${name}.txt` };
    case 'md':
      return { bytes: Buffer.from(`# ${input.title}\n\n${toMarkdown(blocks)}`), ctype: 'text/markdown; charset=utf-8', name: `${name}.md` };
    case 'json':
      return { bytes: Buffer.from(JSON.stringify({ title: input.title, html: input.html, text: toText(blocks), headings, blocks, media: mediaList, ...(seo ? { seo } : {}) }, null, 2)), ctype: 'application/json; charset=utf-8', name: `${name}.json` };
    case 'docx':
      return { bytes: docx(input.title, blocks, input.media), ctype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: `${name}.docx` };
    case 'pdf':
      return { bytes: await pdf(input.title, blocks, input.media), ctype: 'application/pdf', name: `${name}.pdf` };
    case 'zip': {
      let html = input.html;
      const files: { name: string; data: Buffer | string }[] = [];
      const packaged: { source: string; path: string; type: string; bytes: number }[] = [];
      if (input.includeMedia) {
        let n = 1;
        for (const [url, file] of input.media) {
          const ext = file.mime.split('/')[1].replace('jpeg', 'jpg');
          const path = `media/${String(n++).padStart(3, '0')}-${slugName(file.name.replace(/\.[^.]+$/, ''))}.${ext}`;
          files.push({ name: path, data: file.bytes });
          packaged.push({ source: url, path, type: file.mime, bytes: file.bytes.length });
          html = html.split(url).join(path);
        }
      }
      const external = mediaList.filter((m) => !(input.includeMedia && m.packaged)).map((m) => m.source);
      const manifest = { title: input.title, generated_at: new Date().toISOString(), packaged_media: packaged, external_media: external, forms: blocks.filter((b) => b.type === 'form').map((b) => (b as { url: string }).url) };
      const readme = [
        `${input.title}`,
        '',
        'Contents: article.html (open in a browser), css/style.css, article.md, article.txt, metadata.json, asset-manifest.json.',
        input.includeMedia ? `${packaged.length} approved media file(s) are packaged in media/.` : 'Media is linked, not packaged (Include media was off).',
        external.length ? `${external.length} media item(s) stay hosted externally; see asset-manifest.json.` : 'No external media dependencies.',
        manifest.forms.length ? 'Embedded forms are AmpliVerify-hosted and need internet access to accept submissions.' : '',
        'No editor scripts, credentials or form submissions are included.',
      ]
        .filter((l) => l !== '')
        .join('\n');
      files.unshift(
        { name: 'article.html', data: htmlDocument(input, html, 'css/style.css') },
        { name: 'css/style.css', data: CSS },
        { name: 'article.md', data: `# ${input.title}\n\n${toMarkdown(blocks)}` },
        { name: 'article.txt', data: toText(blocks) },
        { name: 'metadata.json', data: JSON.stringify({ title: input.title, headings, ...(seo ? { seo } : {}) }, null, 2) },
        { name: 'asset-manifest.json', data: JSON.stringify(manifest, null, 2) },
        { name: 'README.txt', data: `${readme}\n` },
      );
      return { bytes: zip(files), ctype: 'application/zip', name: `${name}.zip` };
    }
  }
}
