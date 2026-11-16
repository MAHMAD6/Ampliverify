import { inflateRawSync } from 'zlib';
import { hostedFormPage } from '../../src/studio/hosted-form';
import { normalizeConfig } from '../../src/studio/studio.adapters';
import { renderExport, toBlocks, toMarkdown } from '../../src/studio/studio.export';
import { imageSize } from '../../src/studio/studio-media.service';
import { assertNoLocalMedia, assertNoOfflineForms, sanitizeArticle, validateFormSchema, validateFormStyle } from '../../src/studio/studio.security';

/** Reads the entries of a ZIP built by the export writer. */
function unzip(buf: Buffer) {
  const out = new Map<string, Buffer>();
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8');
    const data = buf.subarray(i + 30 + nameLen, i + 30 + nameLen + size);
    out.set(name, method === 8 ? inflateRawSync(data) : data);
    i += 30 + nameLen + size;
  }
  return out;
}

describe('Editor Studio sanitizer', () => {
  it('removes active content and unsafe URLs', () => {
    const html = sanitizeArticle('<h1 onclick="x()">Title</h1><script>alert(1)</script><p style="color: red; background: url(x)">Hi <a href="javascript:alert(1)">bad</a> <a href="https://ok.test" target="_blank">ok</a></p><img src="data:image/png;base64,AA" alt="x"><iframe src="https://evil.test/x"></iframe><iframe src="https://www.youtube.com/embed/abc"></iframe>');
    expect(html).not.toMatch(/<script|onclick|javascript|url\(|data:|evil/);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('style="color: red"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('youtube.com/embed/abc');
  });

  it('keeps editor markers in drafts and strips them for publishing', () => {
    const block = '<div class="av-form-block" data-form-status="draft" data-form-schema="%7B%7D" contenteditable="false"><button class="av-form-activate">Activate</button><input type="text" placeholder="Name"></div><figure class="media-block" data-av-local-id="avmedia-1"><div class="av-media-actions"><button data-media-action="up">Up</button></div><img src="blob:https://x/1"></figure>';
    const draft = sanitizeArticle(block, 'draft');
    expect(draft).toContain('data-form-schema="%7B%7D"');
    expect(draft).toContain('data-av-local-id="avmedia-1"');
    expect(draft).toContain('<input');
    expect(draft).not.toContain('blob:');
    const live = sanitizeArticle(block, 'publish');
    expect(live).not.toMatch(/data-|<button|<input|av-media-actions/);
  });

  it('blocks local media and offline forms', () => {
    expect(() => assertNoLocalMedia('<figure data-av-local-id="a"></figure>')).toThrow();
    expect(() => assertNoLocalMedia('<img src="blob:https://x/1">')).toThrow();
    expect(() => assertNoLocalMedia('<img src="https://cdn.test/a.png">')).not.toThrow();
    expect(() => assertNoOfflineForms('<div class="av-form-block" data-form-status="draft"></div>')).toThrow();
    expect(() => assertNoOfflineForms('<div class="av-form-block" data-form-status="active"></div>')).not.toThrow();
  });
});

describe('Hosted form schema', () => {
  const form = { name: 'Contact', fields: [{ key: 'email', label: 'Email', kind: 'email', required: true }], style: { width: 60, height: 0, background: '#ffffff' } };

  it('validates fields and the V12 width/height contract', () => {
    const { schema, style } = validateFormSchema(form);
    expect(schema.fields[0]).toMatchObject({ key: 'email', kind: 'email', required: true });
    expect(style).toMatchObject({ width: 60, height: 0 });
    expect(validateFormStyle({ height: 400 }).height).toBe(400);
    expect(() => validateFormStyle({ height: 100 })).toThrow(/160/);
    expect(() => validateFormStyle({ width: 20 })).toThrow(/30/);
    expect(() => validateFormStyle({ background: 'red;}' })).toThrow();
    expect(() => validateFormSchema({ ...form, fields: [{ key: 'x', label: 'X', kind: 'file' }] })).toThrow();
    expect(() => validateFormSchema({ ...form, privacy_url: 'javascript:alert(1)' })).toThrow();
  });

  it('renders an escaped, styled page', () => {
    const { schema, style } = validateFormSchema({ ...form, name: 'Quote <b>', style: { width: 80, height: 300, button: '#112233' } });
    const page = hostedFormPage('11111111-1111-4111-8111-111111111111', schema, style, 'https://app.test/forms/public/1/submit');
    expect(page).toContain('Quote &lt;b&gt;');
    expect(page).toContain('width:80%');
    expect(page).toContain('height:300px');
    expect(page).toContain('#112233');
  });
});

describe('Connector configuration', () => {
  it('normalizes and validates provider settings', () => {
    expect(normalizeConfig('wordpress', { site: 'https://blog.example.com/', username: 'me', token: 'abc' })).toMatchObject({ host: 'blog.example.com', config: { site: 'https://blog.example.com' } });
    expect(normalizeConfig('shopify', { shop: 'https://Store.myshopify.com/admin', token: 't', blog_id: 'gid://shopify/Blog/1', author: 'A' }).config.shop).toBe('store.myshopify.com');
    expect(() => normalizeConfig('wordpress', { site: 'http://blog.example.com', username: 'me', token: 'abc' })).toThrow(/https/);
    expect(() => normalizeConfig('custom', { endpoint: 'https://localhost/hook', token: 't' })).toThrow(/Private/);
    expect(() => normalizeConfig('ghost', { site: 'https://g.example.com', token: 'not-a-key' })).toThrow(/Ghost/);
    expect(() => normalizeConfig('strapi', { site: 'https://s.example.com', token: 't' })).toThrow(/collection/);
  });
});

describe('Exports', () => {
  const html = '<h1>Guide</h1><p>Intro with <strong>bold</strong> and <a href="https://example.com">a link</a>.</p><h2>Steps</h2><ol><li>One</li><li>Two</li></ol><figure><img src="https://cdn.test/a.png" alt="Chart"><figcaption>Figure 1</figcaption></figure><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
  const input = { title: 'Guide', html, description: 'About it', keyword: 'guide', includeSeo: true, includeMedia: true, media: new Map() };

  it('builds a canonical block model and Markdown', () => {
    const blocks = toBlocks(html);
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'heading', 'list', 'image', 'table']);
    const md = toMarkdown(blocks);
    expect(md).toContain('# Guide');
    expect(md).toContain('**bold**');
    expect(md).toContain('[a link](https://example.com)');
    expect(md).toContain('1. One');
    expect(md).toContain('![Chart](https://cdn.test/a.png)');
  });

  it('writes valid DOCX, PDF and ZIP packages', async () => {
    const docx = await renderExport('docx', input);
    const parts = unzip(docx.bytes);
    expect([...parts.keys()]).toEqual(expect.arrayContaining(['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml']));
    const doc = parts.get('word/document.xml')!.toString();
    expect(doc).toContain('w:val="Heading2"');
    expect(doc).toContain('<w:numId w:val="2"/>');

    const pdf = await renderExport('pdf', input);
    expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');

    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const media = new Map([['https://cdn.test/a.png', { bytes: png, mime: 'image/png', width: 10, height: 10, name: 'chart.png' }]]);
    const zip = unzip((await renderExport('zip', { ...input, media })).bytes);
    expect(zip.get('article.html')!.toString()).toContain('src="media/001-chart.png"');
    expect(zip.has('media/001-chart.png')).toBe(true);
    expect(JSON.parse(zip.get('metadata.json')!.toString()).seo.primary_keyword).toBe('guide');
  });
});

describe('Image header sizing', () => {
  it('reads PNG and GIF dimensions without decoding', () => {
    const png = Buffer.alloc(24);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(imageSize(png, 'image/png')).toEqual({ width: 640, height: 480 });
    const gif = Buffer.from('GIF89a\x20\x03\x58\x02', 'latin1');
    expect(imageSize(gif, 'image/gif')).toEqual({ width: 800, height: 600 });
  });
});
