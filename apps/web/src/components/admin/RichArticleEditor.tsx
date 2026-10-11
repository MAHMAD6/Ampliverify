'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bold,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  HelpCircle,
  Image as ImageIcon,
  Italic,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  ListTree,
  Lock,
  Maximize2,
  Megaphone,
  Minimize2,
  Minus,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '../ui';
import { Toggle } from '../ui/Toggle';
import { apiAction, uploadAction } from '@/lib/actions';
import { Markdown } from '../public/Markdown';
import { videoEmbed } from '@/lib/media';
import { AdminHeader } from './AdminParts';
import { CMS_KINDS, type AdminArticle } from './cms';
import s from './rich-editor.module.css';

export type MediaItem = { id: string; kind: 'image' | 'video'; label: string; url: string };
type Kind = 'blog' | 'guides';
type Related = { id: string; title: string };

const slugify = (v: string) =>
  v
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
const toLocal = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m === 1 ? '1 minute ago' : m < 60 ? `${m} minutes ago` : `${Math.round(m / 60)} hours ago`;
};
const mediaPath = (id: string) => `/media/${id}`;

type State = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string;
  categoryId: string;
  authorId: string;
  featuredMediaId: string;
  tags: string[];
  readingMinutes: string;
  showToc: boolean;
  showKeyTakeaways: boolean;
  allowComments: boolean;
  relatedIds: string[];
  seoTitle: string;
  metaDescription: string;
};

const BLOCKS: { key: string; label: string; hint: string; icon: React.ReactNode; markdown?: string; action?: 'video' | 'image' }[] = [
  { key: 'toc', label: 'Table of Contents', hint: 'Auto-generates from headings', icon: <ListTree size={22} />, markdown: '' },
  { key: 'takeaways', label: 'Key Takeaways', hint: 'Add key points', icon: <Lightbulb size={22} />, markdown: '## Key takeaways\n\n- First point\n- Second point\n- Third point' },
  { key: 'faq', label: 'FAQ Section', hint: 'Add common questions', icon: <HelpCircle size={22} />, markdown: '## Frequently asked questions\n\n### Question?\n\nAnswer.' },
  { key: 'cta', label: 'CTA Block', hint: 'Add a call to action', icon: <Megaphone size={22} />, markdown: '> **Ready to start?** [Get started free](/signup)' },
  { key: 'video', label: 'Video Block', hint: 'Add an explainer video', icon: <PlayCircle size={22} />, action: 'video' },
  { key: 'image', label: 'Image Block', hint: 'Add an image with caption', icon: <ImageIcon size={22} />, action: 'image' },
  { key: 'quote', label: 'Quote Block', hint: 'Highlight an important quote', icon: <Quote size={22} />, markdown: '> **Rule of thumb:** Write the key idea here.' },
  { key: 'code', label: 'Code Block', hint: 'Add code or structured data', icon: <Code2 size={22} />, markdown: '```json\n{\n  "@context": "https://schema.org"\n}\n```' },
];

/**
 * Create / edit Guide or Blog Post (docs/design: Create Guide screenshot).
 * Drafts auto-save to the server every 30 seconds while there are unsaved
 * changes; published items are never auto-saved (edits go live only on an
 * explicit save). Bodies are markdown, rendered exactly like the public site.
 */
export function RichArticleEditor({
  kind,
  article,
  categories,
  authors,
  media: initialMedia,
  guides,
  siteUrl,
}: {
  kind: Kind;
  article: (AdminArticle & { readingMinutes?: number | null; showToc?: boolean; showKeyTakeaways?: boolean; allowComments?: boolean; related?: { related: Related }[] }) | null;
  categories: { id: string; name: string }[];
  authors: { id: string; displayName: string }[];
  media: MediaItem[];
  guides: Related[];
  siteUrl: string;
}) {
  const k = CMS_KINDS[kind];
  const router = useRouter();
  const [id, setId] = useState(article?.id ?? null);
  const initial: State = {
    title: article?.title ?? '',
    slug: article?.slug ?? '',
    excerpt: article?.excerpt ?? '',
    body: article?.body ?? '',
    status: article?.status ?? 'DRAFT',
    publishedAt: toLocal(article?.publishedAt),
    categoryId: article?.categoryId ?? '',
    authorId: article?.authorId ?? '',
    featuredMediaId: article?.featuredMediaId ?? '',
    tags: (article?.tags ?? []).map((t) => t.tag.name),
    readingMinutes: article?.readingMinutes ? String(article.readingMinutes) : '',
    showToc: article?.showToc ?? true,
    showKeyTakeaways: article?.showKeyTakeaways ?? true,
    allowComments: article?.allowComments ?? false,
    relatedIds: (article?.related ?? []).map((r) => r.related.id),
    seoTitle: article?.seoTitle ?? '',
    metaDescription: article?.metaDescription ?? '',
  };
  const [st, setSt] = useState<State>(initial);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initial));
  const [slugTouched, setSlugTouched] = useState(!!article?.slug);
  const [lastSaved, setLastSaved] = useState<{ at: number; auto: boolean } | null>(article ? { at: new Date(article.updatedAt).getTime(), auto: false } : null);
  const [, tick] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [full, setFull] = useState(false);
  const [menu, setMenu] = useState<null | 'video' | 'image' | 'more' | 'publish'>(null);
  const [picker, setPicker] = useState<null | { kind: 'image' | 'video'; target: 'body' | 'featured' }>(null);
  const [urlPrompt, setUrlPrompt] = useState<null | 'video' | 'image' | 'link'>(null);
  const [media, setMedia] = useState(initialMedia);
  const [tagDraft, setTagDraft] = useState('');
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const ta = useRef<HTMLTextAreaElement>(null);
  const dirty = JSON.stringify(st) !== savedJson;
  const set = <K extends keyof State>(key: K, v: State[K]) => setSt((x) => ({ ...x, [key]: v }));

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const payload = useCallback(
    (s0: State, statusOverride?: State['status']) => ({
      title: s0.title.trim(),
      slug: s0.slug || slugify(s0.title),
      excerpt: s0.excerpt.trim() || null,
      body: s0.body,
      status: statusOverride ?? s0.status,
      publishedAt: s0.publishedAt ? new Date(s0.publishedAt).toISOString() : null,
      categoryId: s0.categoryId || null,
      authorId: s0.authorId || null,
      featuredMediaId: s0.featuredMediaId || null,
      tags: s0.tags,
      readingMinutes: s0.readingMinutes ? Number(s0.readingMinutes) : null,
      showToc: s0.showToc,
      showKeyTakeaways: s0.showKeyTakeaways,
      allowComments: s0.allowComments,
      ...(kind === 'guides' ? { relatedIds: s0.relatedIds } : {}),
      seoTitle: s0.seoTitle.trim() || null,
      metaDescription: s0.metaDescription.trim() || null,
    }),
    [kind],
  );

  const save = useCallback(
    async (opts: { status?: State['status']; auto?: boolean } = {}) => {
      if (!st.title.trim()) {
        if (!opts.auto) setMsg({ ok: false, text: 'Enter a title.' });
        return false;
      }
      if (!opts.auto && !st.excerpt.trim()) {
        setMsg({ ok: false, text: 'Enter an excerpt.' });
        return false;
      }
      const body = payload(st, opts.status);
      const r = id ? await apiAction<AdminArticle>('PATCH', `/admin/content/${kind}/${id}`, body, [k.admin]) : await apiAction<AdminArticle>('POST', `/admin/content/${kind}`, body, [k.admin]);
      if (!r.ok) {
        if (!opts.auto) setMsg({ ok: false, text: r.message });
        return false;
      }
      const next = { ...st, status: r.data.status, slug: r.data.slug, publishedAt: toLocal(r.data.publishedAt) };
      setSt(next);
      setSavedJson(JSON.stringify(next));
      setLastSaved({ at: Date.now(), auto: !!opts.auto });
      if (!opts.auto) setMsg({ ok: true, text: r.data.status === 'PUBLISHED' ? (r.data.publishedAt && new Date(r.data.publishedAt) > new Date() ? 'Scheduled.' : 'Published.') : 'Saved.' });
      if (!id) {
        setId(r.data.id);
        router.replace(`${k.admin}/${r.data.id}`);
      }
      return true;
    },
    [st, id, kind, k.admin, payload, router],
  );

  // Auto-save drafts (never published content) every 30 s while dirty.
  useEffect(() => {
    if (!dirty || st.status !== 'DRAFT' || !st.title.trim()) return;
    const t = setTimeout(() => void save({ auto: true }), 30_000);
    return () => clearTimeout(t);
  }, [dirty, st, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ── Body editing ──────────────────────────────────────────────────────
  const commitBody = (next: string) => {
    setPast((p) => [...p.slice(-60), st.body]);
    setFuture([]);
    set('body', next);
  };
  const insertBlock = (block: string) => {
    const el = ta.current;
    const at = el ? el.selectionEnd : st.body.length;
    const before = st.body.slice(0, at);
    const sep = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    commitBody(before + sep + block + '\n\n' + st.body.slice(at));
    setTab('write');
  };
  const wrap = (before: string, after = before, placeholder = 'text') => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    commitBody(st.body.slice(0, a) + before + (st.body.slice(a, b) || placeholder) + after + st.body.slice(b));
    requestAnimationFrame(() => el.focus());
  };
  const linePrefix = (prefix: string) => {
    const el = ta.current;
    if (!el) return;
    const a = el.selectionStart;
    const start = st.body.lastIndexOf('\n', a - 1) + 1;
    const line = st.body.slice(start).match(/^(#{1,4}\s|>\s|-\s|\d+\.\s)?/)?.[0] ?? '';
    commitBody(st.body.slice(0, start) + prefix + st.body.slice(start + line.length));
    requestAnimationFrame(() => el.focus());
  };
  const currentBlock = () => {
    const el = ta.current;
    if (!el) return 'p';
    const start = st.body.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const m = st.body.slice(start).match(/^(#{2,4})\s/);
    return m ? `h${m[1].length}` : 'p';
  };
  const [blockType, setBlockType] = useState('p');

  const insertVideo = (url: string, title = 'Video') => {
    if (!videoEmbed(url)) return setMsg({ ok: false, text: 'Use a YouTube or Vimeo link, or a video from the Media Library.' });
    insertBlock(`![video: ${title.replace(/[\]\n]/g, '')}](${url})`);
  };
  const insertImage = (url: string, alt = '') => insertBlock(`![${alt.replace(/[\]\n]/g, '')}](${url})`);

  const upload = (accept: string, then: (m: MediaItem) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const isVideo = file.type.startsWith('video/');
      if (file.size > (isVideo ? 50 : 10) * 1024 * 1024) return setMsg({ ok: false, text: isVideo ? 'Videos must be 50 MB or smaller.' : 'Images must be 10 MB or smaller.' });
      const form = new FormData();
      form.set('file', file);
      form.set('altText', file.name.replace(/\.[^.]+$/, '').slice(0, 300));
      setMsg({ ok: true, text: `Uploading ${file.name}…` });
      start(async () => {
        const r = await uploadAction<{ id: string; mimeType: string; altText: string | null }>('/admin/media', form, ['/admin/media']);
        if (!r.ok) return setMsg({ ok: false, text: r.message });
        const item: MediaItem = { id: r.data.id, kind: r.data.mimeType.startsWith('video/') ? 'video' : 'image', label: r.data.altText || file.name, url: mediaPath(r.data.id) };
        setMedia((m) => [item, ...m]);
        setMsg({ ok: true, text: 'Uploaded to the Media Library.' });
        then(item);
      });
    };
    input.click();
  };

  const words = st.body.trim() ? st.body.trim().split(/\s+/).length : 0;
  const estMinutes = Math.max(1, Math.round(words / 225));
  const featured = media.find((m) => m.id === st.featuredMediaId) ?? (st.featuredMediaId ? { id: st.featuredMediaId, kind: 'image' as const, label: 'Featured image', url: mediaPath(st.featuredMediaId) } : null);
  const scheduled = st.publishedAt && new Date(st.publishedAt) > new Date();
  const relatedChoices = guides.filter((g) => g.id !== id && !st.relatedIds.includes(g.id));
  const statusLine = lastSaved ? `${lastSaved.auto ? 'Auto-saved' : 'Saved'} ${ago(lastSaved.at)}` : 'Not saved yet';

  const tools = useMemo(
    () => [
      { key: 'b', title: 'Bold', icon: <Bold size={17} />, run: () => wrap('**') },
      { key: 'i', title: 'Italic', icon: <Italic size={17} />, run: () => wrap('*') },
      { key: 's', title: 'Strikethrough', icon: <Strikethrough size={17} />, run: () => wrap('~~') },
      { key: 'ul', title: 'Bulleted list', icon: <List size={17} />, run: () => linePrefix('- ') },
      { key: 'ol', title: 'Numbered list', icon: <ListOrdered size={17} />, run: () => linePrefix('1. ') },
      { key: 'q', title: 'Quote / callout', icon: <Quote size={17} />, run: () => linePrefix('> ') },
      { key: 'link', title: 'Link', icon: <Link2 size={17} />, run: () => setUrlPrompt('link') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st.body],
  );

  return (
    <>
      <AdminHeader
        section="Content Management"
        parent={{ label: k.plural, href: k.admin }}
        page={id ? st.title || 'Untitled' : `Create ${k.noun}`}
        title={id ? `Edit ${k.noun}` : `Create ${k.noun}`}
        description={kind === 'guides' ? 'Write, optimize, and publish a guide to share insights, tutorials, and resources with your audience.' : 'Write, optimize, and publish a blog post.'}
        actions={
          <div className={s.headActions}>
            <span className={s.savedState}>
              <CheckCircle2 size={22} className={dirty ? s.dirtyIcon : s.cleanIcon} />
              <span>
                {dirty ? 'Unsaved changes' : statusLine}
                {lastSaved && <small>Last saved {new Date(lastSaved.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</small>}
              </span>
            </span>
            <Button variant="outline" onClick={() => start(async () => void (await save({ status: st.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' })))} disabled={pending}>
              {st.status === 'PUBLISHED' ? 'Save Changes' : 'Save Draft'}
            </Button>
            <Button variant="outline" icon={<Eye size={18} />} onClick={() => setTab('preview')}>
              Preview
            </Button>
            <span className={s.split}>
              <Button onClick={() => start(async () => void (await save({ status: 'PUBLISHED' })))} disabled={pending}>
                {scheduled ? 'Schedule' : st.status === 'PUBLISHED' ? 'Update' : 'Publish'}
              </Button>
              <button type="button" className={s.splitBtn} aria-label="More publish options" onClick={() => setMenu(menu === 'publish' ? null : 'publish')}>
                <ChevronDown size={18} />
              </button>
              {menu === 'publish' && (
                <div className={s.menu} role="menu">
                  <button type="button" role="menuitem" onClick={() => (setMenu(null), start(async () => void (await save({ status: 'PUBLISHED' }))))}>
                    {scheduled ? 'Schedule for the publish date' : 'Publish now'}
                  </button>
                  {st.status === 'PUBLISHED' && (
                    <button type="button" role="menuitem" onClick={() => (setMenu(null), start(async () => void (await save({ status: 'DRAFT' }))))}>
                      Unpublish (back to draft)
                    </button>
                  )}
                  <button type="button" role="menuitem" onClick={() => (setMenu(null), start(async () => void (await save({ status: 'ARCHIVED' }))))}>
                    Archive
                  </button>
                  {id && st.status === 'PUBLISHED' && !scheduled && (
                    <a role="menuitem" href={`${k.publicBase}/${st.slug}`} target="_blank" rel="noopener noreferrer">
                      View live
                    </a>
                  )}
                </div>
              )}
            </span>
          </div>
        }
      />
      {msg && (
        <p className={msg.ok ? s.ok : s.bad} role="status">
          {msg.text}
        </p>
      )}

      <div className={`${s.layout} ${full ? s.fullscreen : ''}`}>
        <section className={s.main}>
          <div className={s.row2}>
            <Field label={<>Title <span className={s.req}>*</span></>} htmlFor="r-title">
              <Input
                id="r-title"
                value={st.title}
                maxLength={200}
                placeholder="Enter a clear title"
                onChange={(e) => setSt((x) => ({ ...x, title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) }))}
              />
            </Field>
            <Field label={<>Slug <span className={s.req}>*</span></>} htmlFor="r-slug" hint={<span className={s.url}>URL: {siteUrl}{k.publicBase}/{st.slug || slugify(st.title) || 'your-slug'}</span>}>
              <Input id="r-slug" value={st.slug} maxLength={120} onChange={(e) => (setSlugTouched(true), set('slug', slugify(e.target.value)))} />
            </Field>
          </div>
          <Field label={<>Excerpt <span className={s.req}>*</span></>} htmlFor="r-excerpt">
            <div className={s.counted}>
              <Textarea id="r-excerpt" value={st.excerpt} maxLength={160} onChange={(e) => set('excerpt', e.target.value)} placeholder="A short summary for listings and search previews" style={{ minHeight: 76 }} />
              <small className={st.excerpt.length > 150 ? s.warn : undefined}>{st.excerpt.length} / 160 characters</small>
            </div>
          </Field>

          <div className={s.contentHead}>
            <label htmlFor="r-body" className={s.label}>
              Content <span className={s.req}>*</span>
            </label>
            <div className={s.tabs} role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>
                Write
              </button>
              <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>
                Preview
              </button>
            </div>
          </div>
          <div className={s.editor}>
            <div className={s.toolbar} role="toolbar" aria-label="Formatting">
              <select
                aria-label="Block type"
                className={s.blockSelect}
                value={blockType}
                disabled={tab === 'preview'}
                onChange={(e) => {
                  setBlockType(e.target.value);
                  linePrefix(e.target.value === 'p' ? '' : `${'#'.repeat(Number(e.target.value.slice(1)))} `);
                }}
              >
                <option value="p">Paragraph</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="h4">Heading 4</option>
              </select>
              <span className={s.sep} />
              {tools.map((t) => (
                <button key={t.key} type="button" className={s.tool} title={t.title} aria-label={t.title} onClick={t.run} disabled={tab === 'preview'}>
                  {t.icon}
                </button>
              ))}
              <span className={s.toolWrap}>
                <button type="button" className={`${s.tool} ${menu === 'image' ? s.toolOn : ''}`} title="Insert image" aria-label="Insert image" disabled={tab === 'preview'} onClick={() => setMenu(menu === 'image' ? null : 'image')}>
                  <ImageIcon size={17} />
                </button>
                {menu === 'image' && (
                  <InsertMenu
                    title="Insert Image"
                    onClose={() => setMenu(null)}
                    items={[
                      { icon: <Upload size={20} />, title: 'Upload Image', text: 'PNG, JPEG, GIF or WebP (max 10 MB)', run: () => upload('image/png,image/jpeg,image/gif,image/webp', (m) => insertImage(m.url, m.label)) },
                      { icon: <Link2 size={20} />, title: 'Insert from URL', text: 'An image address (https)', run: () => setUrlPrompt('image') },
                      { icon: <ImageIcon size={20} />, title: 'Select from Media Library', text: 'Choose an existing image', run: () => setPicker({ kind: 'image', target: 'body' }) },
                    ]}
                  />
                )}
              </span>
              <span className={s.toolWrap}>
                <button type="button" className={`${s.tool} ${menu === 'video' ? s.toolOn : ''}`} title="Insert video" aria-label="Insert video" disabled={tab === 'preview'} onClick={() => setMenu(menu === 'video' ? null : 'video')}>
                  <Video size={17} />
                </button>
                {menu === 'video' && (
                  <InsertMenu
                    title="Insert Video"
                    onClose={() => setMenu(null)}
                    items={[
                      { icon: <Upload size={20} />, title: 'Upload Video', text: 'Upload a video file (MP4, WebM, MOV)', run: () => upload('video/mp4,video/webm,video/quicktime', (m) => insertVideo(m.url, m.label)) },
                      { icon: <Link2 size={20} />, title: 'Insert from URL', text: 'YouTube, Vimeo or other supported links', run: () => setUrlPrompt('video') },
                      { icon: <Video size={20} />, title: 'Select from Media Library', text: 'Choose an existing video', run: () => setPicker({ kind: 'video', target: 'body' }) },
                    ]}
                  />
                )}
              </span>
              <button type="button" className={s.tool} title="Table" aria-label="Insert table" disabled={tab === 'preview'} onClick={() => insertBlock('| Column | Column |\n| --- | --- |\n| Value | Value |')}>
                <Table2 size={17} />
              </button>
              <button type="button" className={s.tool} title="Code" aria-label="Inline code" disabled={tab === 'preview'} onClick={() => wrap('`')}>
                <Code2 size={17} />
              </button>
              <button type="button" className={s.tool} title="Divider" aria-label="Insert divider" disabled={tab === 'preview'} onClick={() => insertBlock('---')}>
                <Minus size={17} />
              </button>
              <span className={s.sep} />
              <button
                type="button"
                className={s.tool}
                title="Undo"
                aria-label="Undo"
                disabled={!past.length || tab === 'preview'}
                onClick={() => {
                  setFuture((f) => [st.body, ...f]);
                  set('body', past[past.length - 1]);
                  setPast((p) => p.slice(0, -1));
                }}
              >
                <Undo2 size={17} />
              </button>
              <button
                type="button"
                className={s.tool}
                title="Redo"
                aria-label="Redo"
                disabled={!future.length || tab === 'preview'}
                onClick={() => {
                  setPast((p) => [...p, st.body]);
                  set('body', future[0]);
                  setFuture((f) => f.slice(1));
                }}
              >
                <Redo2 size={17} />
              </button>
              <span className={s.sep} />
              <span className={s.toolWrap}>
                <button type="button" className={s.tool} title="More" aria-label="More formatting" disabled={tab === 'preview'} onClick={() => setMenu(menu === 'more' ? null : 'more')}>
                  <MoreHorizontal size={17} />
                </button>
                {menu === 'more' && (
                  <div className={s.menu} role="menu" style={{ left: 0, right: 'auto' }}>
                    <button type="button" role="menuitem" onClick={() => (setMenu(null), insertBlock('- [ ] Task\n- [ ] Task'))}>
                      Checklist
                    </button>
                    <button type="button" role="menuitem" onClick={() => (setMenu(null), insertBlock('```\ncode\n```'))}>
                      Code block
                    </button>
                    <button type="button" role="menuitem" onClick={() => (setMenu(null), linePrefix('#### '))}>
                      Heading 4
                    </button>
                  </div>
                )}
              </span>
              <button type="button" className={`${s.tool} ${s.right}`} title={full ? 'Exit full screen' : 'Full screen'} aria-label={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull(!full)}>
                {full ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            </div>
            {tab === 'write' ? (
              <textarea
                ref={ta}
                id="r-body"
                className={s.area}
                value={st.body}
                onChange={(e) => {
                  if (Math.abs(e.target.value.length - st.body.length) > 20 || /\s$/.test(e.target.value)) setPast((p) => [...p.slice(-60), st.body]);
                  set('body', e.target.value);
                }}
                onSelect={() => setBlockType(currentBlock())}
                placeholder="Start writing… Use the toolbar for headings, lists, links, images, videos and tables."
                spellCheck
              />
            ) : (
              <div className={s.preview}>{st.body.trim() ? <Markdown source={st.body} /> : <p className={s.muted}>Nothing to preview yet.</p>}</div>
            )}
            <div className={s.footer}>
              <span>{words.toLocaleString('en-US')} words</span>
              <span>Markdown · raw HTML is not rendered</span>
            </div>
          </div>

          <div className={s.blocks}>
            <b>
              Content Blocks <span className={s.muted}>(Optional)</span>
            </b>
            <p className={s.muted}>Quickly add pre-formatted sections to improve readability and engagement.</p>
            <div className={s.blockGrid}>
              {BLOCKS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={`${s.block} ${b.key === 'toc' && st.showToc ? s.blockOn : ''}`}
                  onClick={() => {
                    if (b.key === 'toc') return set('showToc', !st.showToc);
                    if (b.action === 'video') return setMenu('video');
                    if (b.action === 'image') return setMenu('image');
                    insertBlock(b.markdown!);
                  }}
                >
                  <span className={s.blockIcon}>{b.icon}</span>
                  <span>
                    <b>{b.label}</b>
                    <small>{b.key === 'toc' ? (st.showToc ? 'On · built from your H2 headings' : 'Off · click to show') : b.hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <details className={s.seo}>
            <summary>
              SEO &amp; GEO metadata <ChevronRight size={16} />
            </summary>
            <Field label="SEO title" htmlFor="r-seo" hint={`${st.seoTitle.length}/60 recommended · defaults to the title`}>
              <Input id="r-seo" value={st.seoTitle} maxLength={300} onChange={(e) => set('seoTitle', e.target.value)} />
            </Field>
            <Field label="Meta description" htmlFor="r-meta" hint={`${st.metaDescription.length}/160 recommended · defaults to the excerpt`}>
              <Textarea id="r-meta" value={st.metaDescription} maxLength={500} onChange={(e) => set('metaDescription', e.target.value)} style={{ minHeight: 70 }} />
            </Field>
          </details>
        </section>

        <aside className={s.side}>
          <section className={s.card}>
            <h3>Publish</h3>
            <Field label="Status" htmlFor="r-status">
              <Select id="r-status" value={st.status} onChange={(e) => set('status', e.target.value as State['status'])}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </Field>
            <Field label="Publish Date" htmlFor="r-date" hint={`You can schedule this ${k.noun.toLowerCase()} to be published later.`}>
              <div className={s.dateRow}>
                <Input id="r-date" type="datetime-local" value={st.publishedAt} onChange={(e) => set('publishedAt', e.target.value)} />
                {st.publishedAt ? (
                  <button type="button" className={s.linkBtn} onClick={() => set('publishedAt', '')}>
                    Publish immediately
                  </button>
                ) : (
                  <small className={s.muted}>Publish immediately</small>
                )}
              </div>
            </Field>
          </section>

          <section className={s.card}>
            <h3>
              <Lock size={14} /> Featured Image
            </h3>
            {featured ? (
              <div className={s.featured}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.url} alt={featured.label} />
                <button type="button" className={s.removeImg} aria-label="Remove featured image" onClick={() => set('featuredMediaId', '')}>
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div className={s.featuredEmpty}>No featured image</div>
            )}
            <div className={s.imgRow}>
              <Button variant="outline" size="sm" onClick={() => setPicker({ kind: 'image', target: 'featured' })}>
                {featured ? 'Change Image' : 'Choose Image'}
              </Button>
              <small className={s.muted}>
                Recommended size: 1200 × 630 px
                <br />
                (JPG, PNG or WebP, max 10MB)
              </small>
            </div>
          </section>

          <section className={s.card}>
            <Field label="Author" htmlFor="r-author">
              <Select id="r-author" value={st.authorId} onChange={(e) => set('authorId', e.target.value)}>
                <option value="">No author (AmpliVerify Team)</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${kind === 'guides' ? 'Guide' : 'Post'} Category`} htmlFor="r-cat">
              <Select id="r-cat" value={st.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags" htmlFor="r-tags">
              <div className={s.tagBox}>
                {st.tags.map((t) => (
                  <span key={t} className={s.tag}>
                    {t}
                    <button type="button" aria-label={`Remove tag ${t}`} onClick={() => set('tags', st.tags.filter((x) => x !== t))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  id="r-tags"
                  value={tagDraft}
                  placeholder={st.tags.length ? '' : 'Add tags...'}
                  maxLength={60}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && tagDraft.trim()) {
                      e.preventDefault();
                      if (st.tags.length < 20 && !st.tags.some((t) => t.toLowerCase() === tagDraft.trim().toLowerCase())) set('tags', [...st.tags, tagDraft.trim()]);
                      setTagDraft('');
                    } else if (e.key === 'Backspace' && !tagDraft && st.tags.length) set('tags', st.tags.slice(0, -1));
                  }}
                />
              </div>
            </Field>
          </section>

          <section className={s.card}>
            <h3>
              <HelpCircle size={14} /> {kind === 'guides' ? 'Guide' : 'Post'} Settings
            </h3>
            <div className={s.setting}>
              <span>Estimated Reading Time</span>
              <span className={s.minutes}>
                <Input type="number" min={1} max={600} value={st.readingMinutes} placeholder={String(estMinutes)} aria-label="Estimated reading time in minutes" onChange={(e) => set('readingMinutes', e.target.value)} />
                minutes
              </span>
            </div>
            <div className={s.toggles}>
              <label>
                <Toggle label="Show Table of Contents" checked={st.showToc} onChange={(v) => set('showToc', v)} /> Show Table of Contents
              </label>
              <label>
                <Toggle label="Show Key Takeaways" checked={st.showKeyTakeaways} onChange={(v) => set('showKeyTakeaways', v)} /> Show Key Takeaways
              </label>
              <label>
                <Toggle label="Allow Comments" checked={st.allowComments} onChange={(v) => set('allowComments', v)} /> Allow Comments
              </label>
            </div>
          </section>

          {kind === 'guides' && (
            <section className={s.card}>
              <div className={s.relHead}>
                <h3 style={{ margin: 0 }}>
                  Related Guides <span className={s.muted}>(Optional)</span>
                </h3>
                <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setRelatedOpen(!relatedOpen)} disabled={st.relatedIds.length >= 6}>
                  Add Related Guides
                </Button>
              </div>
              {relatedOpen && (
                <Select
                  aria-label="Choose a related guide"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) set('relatedIds', [...st.relatedIds, e.target.value]);
                    setRelatedOpen(false);
                  }}
                >
                  <option value="">{relatedChoices.length ? 'Choose a guide…' : 'No other guides yet'}</option>
                  {relatedChoices.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </Select>
              )}
              {st.relatedIds.map((rid, i) => (
                <div key={rid} className={s.relRow}>
                  <span>
                    {i + 1}. {guides.find((g) => g.id === rid)?.title ?? 'Guide'}
                  </span>
                  <button type="button" aria-label="Remove related guide" onClick={() => set('relatedIds', st.relatedIds.filter((x) => x !== rid))}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {!st.relatedIds.length && <p className={s.muted}>When empty, the latest guides in the same category are shown.</p>}
            </section>
          )}
          {id && (
            <Button
              variant="ghost"
              icon={<Trash2 size={16} />}
              onClick={() =>
                start(async () => {
                  if (!window.confirm(`Delete “${st.title}” permanently?`)) return;
                  const r = await apiAction('DELETE', `/admin/content/${kind}/${id}`, undefined, [k.admin]);
                  if (!r.ok) return setMsg({ ok: false, text: r.message });
                  router.push(k.admin);
                })
              }
            >
              Delete {k.noun}
            </Button>
          )}
        </aside>
      </div>

      {picker && (
        <MediaPicker
          kind={picker.kind}
          items={media.filter((m) => m.kind === picker.kind)}
          onClose={() => setPicker(null)}
          onUpload={() =>
            upload(picker.kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/gif,image/webp', (m) => {
              if (picker.target === 'featured') set('featuredMediaId', m.id);
              else if (m.kind === 'video') insertVideo(m.url, m.label);
              else insertImage(m.url, m.label);
              setPicker(null);
            })
          }
          onPick={(m) => {
            if (picker.target === 'featured') set('featuredMediaId', m.id);
            else if (m.kind === 'video') insertVideo(m.url, m.label);
            else insertImage(m.url, m.label);
            setPicker(null);
          }}
        />
      )}
      {urlPrompt && (
        <UrlPrompt
          kind={urlPrompt}
          onClose={() => setUrlPrompt(null)}
          onSubmit={(url, text) => {
            if (urlPrompt === 'video') insertVideo(url, text || 'Video');
            else if (urlPrompt === 'image') insertImage(url, text);
            else wrap('[', `](${url})`, text || 'link text');
            setUrlPrompt(null);
          }}
        />
      )}
    </>
  );
}

function InsertMenu({ title, items, onClose }: { title: string; items: { icon: React.ReactNode; title: string; text: string; run: () => void }[]; onClose: () => void }) {
  return (
    <div className={s.insertMenu} role="menu" aria-label={title}>
      <b>{title}</b>
      {items.map((i) => (
        <button
          key={i.title}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            i.run();
          }}
        >
          <span className={s.insertIcon}>{i.icon}</span>
          <span>
            <b>{i.title}</b>
            <small>{i.text}</small>
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}

function MediaPicker({ kind, items, onPick, onUpload, onClose }: { kind: 'image' | 'video'; items: MediaItem[]; onPick: (m: MediaItem) => void; onUpload: () => void; onClose: () => void }) {
  return (
    <div className={s.modalBack} role="dialog" aria-modal="true" aria-label={`Select ${kind}`}>
      <div className={s.modal}>
        <div className={s.modalHead}>
          <b>Select from Media Library</b>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={s.pickGrid}>
          {items.length === 0 && <p className={s.muted}>No {kind}s in the Media Library yet.</p>}
          {items.map((m) => (
            <button key={m.id} type="button" className={s.pick} onClick={() => onPick(m)} title={m.label}>
              {m.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.label} loading="lazy" />
              ) : (
                <video src={m.url} preload="metadata" muted />
              )}
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <div className={s.modalFoot}>
          <Button variant="outline" icon={<Upload size={16} />} onClick={onUpload}>
            Upload {kind === 'video' ? 'Video' : 'Image'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UrlPrompt({ kind, onSubmit, onClose }: { kind: 'video' | 'image' | 'link'; onSubmit: (url: string, text: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const valid = kind === 'link' ? /^(https?:\/\/|\/)/.test(url) : kind === 'video' ? !!videoEmbed(url) : /^https:\/\//.test(url);
  return (
    <div className={s.modalBack} role="dialog" aria-modal="true" aria-label={kind === 'video' ? 'Insert video from URL' : kind === 'image' ? 'Insert image from URL' : 'Insert link'}>
      <form
        className={s.modal}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(url.trim(), text.trim());
        }}
      >
        <div className={s.modalHead}>
          <b>{kind === 'video' ? 'Insert Video from URL' : kind === 'image' ? 'Insert Image from URL' : 'Insert Link'}</b>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <Field label={kind === 'video' ? 'YouTube or Vimeo URL' : kind === 'image' ? 'Image URL (https)' : 'URL'} htmlFor="u-url">
          <Input id="u-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={kind === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://'} autoFocus />
        </Field>
        <Field label={kind === 'link' ? 'Link text' : kind === 'video' ? 'Title (optional)' : 'Alt text'} htmlFor="u-text">
          <Input id="u-text" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        </Field>
        {url && !valid && <p className={s.bad}>{kind === 'video' ? 'Only YouTube and Vimeo links can be embedded.' : 'Enter a valid https address.'}</p>}
        <div className={s.modalFoot}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid}>
            Insert
          </Button>
        </div>
      </form>
    </div>
  );
}
