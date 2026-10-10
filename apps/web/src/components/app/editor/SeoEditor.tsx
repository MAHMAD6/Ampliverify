'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Clipboard,
  Eye,
  FileText,
  GripVertical,
  History,
  ImageIcon,
  Italic,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  MoreVertical,
  Play,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  SquarePen,
  Trash2,
  Underline,
  Undo2,
  Redo2,
  WandSparkles,
  Zap,
  Info,
} from 'lucide-react';
import { Button, EmptyState, Input, Notice, Select, Textarea } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import { apiAction, apiQuery } from '@/lib/actions';
import { documentToHtml, htmlToSections, newId, sectionHint, sectionLabel, starterOutline, type Section } from './model';
import e from './editor.module.css';

export type EditorAnalysis = {
  scores: { TECHNICAL: number; SEO: number; CONTENT: number; GEO: number; overall: number };
  wordCount: number;
  readingMinutes: number;
  keyword: { keyword: string; inTitle: boolean; inMeta: boolean; inH1: boolean; occurrences: number; density: number } | null;
  issues: { ruleKey: string; title: string; category: 'TECHNICAL' | 'SEO' | 'CONTENT' | 'GEO'; severity: string; guidance: string }[];
};
export type EditorSuggestion = { id: string; type: string; status: string; createdAt: string; title: string; explanation: string; original: string; replacement: string };
type Content = { html: string; title: string; metaDescription: string; slug?: string; focusKeyword?: string };
export type EditorDoc = {
  id: string;
  projectId: string;
  title: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  pageUrl: string | null;
  updatedAt: string;
  version: { versionNo: number; createdAt: string } | null;
  content: Content | null;
  analysis: EditorAnalysis | null;
  suggestions: EditorSuggestion[];
  versions: { id: string; versionNo: number; createdAt: string; author: string }[];
  aiAvailable: boolean;
};
type Meta = { title: string; metaDescription: string; slug: string; focusKeyword: string };

type Target = 'SEO' | 'Content' | 'AI Search (GEO)' | 'All';
const TARGETS: { key: Target; icon: React.ReactNode; instruction?: string }[] = [
  { key: 'SEO', icon: <Search size={18} />, instruction: 'Prioritize ranking in search results for the focus keyword.' },
  { key: 'Content', icon: <FileText size={18} />, instruction: 'Prioritize content quality, depth and readability.' },
  { key: 'AI Search (GEO)', icon: <Sparkles size={18} />, instruction: 'Prioritize being quoted by AI assistants: direct answers, definitions, clear facts and FAQs.' },
  { key: 'All', icon: <CircleCheck size={18} /> },
];
const INSIGHT_CATEGORIES: Record<'SEO' | 'Content' | 'AI Search (GEO)', { cats: string[]; score: (s: EditorAnalysis['scores']) => number }> = {
  SEO: { cats: ['SEO', 'TECHNICAL'], score: (s) => Math.round((s.SEO + s.TECHNICAL) / 2) },
  Content: { cats: ['CONTENT'], score: (s) => s.CONTENT },
  'AI Search (GEO)': { cats: ['GEO'], score: (s) => s.GEO },
};
const SECTION_ACTIONS = ['Improve', 'Expand', 'Shorten', 'Rewrite', 'Change Tone'];
const QUICK: { label: string; focus?: string; instruction?: string; analyze?: boolean }[] = [
  { label: 'Generate Meta Description', focus: 'METADATA', instruction: 'Propose a meta description of at most 155 characters that includes the focus keyword naturally.' },
  { label: 'Optimize for AI Search (GEO)', instruction: 'Make the page easier for AI assistants to quote: answer the main question directly near the top, add concise definitions and an FAQ where it helps.' },
  { label: 'Improve Writing', focus: 'READABILITY' },
  { label: 'Add / Manage Citations', instruction: 'Point out factual claims that should cite a source and where to add the citation. Do not invent sources.' },
  { label: 'Check SEO Issues', analyze: true },
  { label: 'Suggest Internal Links', focus: 'LINK' },
];
const SUGGESTION_TABS: Record<string, string[] | null> = { All: null, Content: ['CONTENT', 'STRUCTURE', 'READABILITY'], SEO: ['KEYWORD', 'METADATA', 'LINK', 'TECHNICAL'] };
const AI_OFF = 'AI suggestions are not configured on this server yet.';
/** AI output and imported pages are untrusted: allow formatting markup only. */
const clean = (html: string) => DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'svg', 'math'], FORBID_ATTR: ['style'] });

const metaOf = (c: Content | null, doc: EditorDoc): Meta => ({ title: c?.title ?? doc.title, metaDescription: c?.metaDescription ?? '', slug: c?.slug ?? '', focusKeyword: c?.focusKeyword ?? '' });
const payload = (sections: Section[], meta: Meta): Content => ({
  html: documentToHtml(sections).replace('<!-- Start writing to generate HTML -->', ''),
  title: meta.title,
  metaDescription: meta.metaDescription,
  ...(meta.slug.trim() ? { slug: meta.slug.trim() } : {}),
  ...(meta.focusKeyword.trim() ? { focusKeyword: meta.focusKeyword.trim() } : {}),
});

/**
 * Section-based page editor backed by the editor API: versioned saves, live
 * scoring with the audit rule engine, Claude suggestions the writer accepts
 * or rejects, version history and WordPress publishing. Unsaved edits are
 * also kept on this device so a closed tab does not lose work.
 */
export function SeoEditor({ doc, projectName, connections }: { doc: EditorDoc; projectName: string | null; connections: { id: string; label: string }[] }) {
  const router = useRouter();
  const backupKey = `av-editor:${doc.id}`;
  const [ready, setReady] = useState(false);
  const [sections, setSections] = useState<Section[]>(() => starterOutline());
  const [meta, setMeta] = useState<Meta>(() => metaOf(doc.content, doc));
  const [saved, setSaved] = useState<string>('');
  const [activeId, setActiveId] = useState<string>('');
  const [history, setHistory] = useState<{ past: Section[][]; future: Section[][] }>({ past: [], future: [] });
  const [target, setTarget] = useState<Target>('All');
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [panel, setPanel] = useState<'write' | 'ask'>('write');
  const [preview, setPreview] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [filter, setFilter] = useState('');
  const [insightTab, setInsightTab] = useState<'SEO' | 'Content' | 'AI Search (GEO)'>('SEO');
  const [suggestionTab, setSuggestionTab] = useState('All');
  const [analysis, setAnalysis] = useState<EditorAnalysis | null>(doc.analysis);
  const [backup, setBackup] = useState<{ sections: Section[]; meta: Meta } | null>(null);
  const [menu, setMenu] = useState<'save' | 'more' | 'history' | null>(null);
  const [ask, setAsk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Load the saved version (DOMParser is browser-only), then any newer local backup.
  useEffect(() => {
    const initial = htmlToSections(doc.content?.html ?? '');
    const m = metaOf(doc.content, doc);
    setSections(initial);
    setActiveId(initial[1]?.id ?? initial[0].id);
    setMeta(m);
    setSaved(JSON.stringify(payload(initial, m)));
    try {
      const raw = localStorage.getItem(backupKey);
      if (raw) {
        const b = JSON.parse(raw) as { sections: Section[]; meta: Meta; baseVersion: number };
        if (b.baseVersion === (doc.version?.versionNo ?? 0) && JSON.stringify(payload(b.sections, b.meta)) !== JSON.stringify(payload(initial, m))) setBackup({ sections: b.sections, meta: b.meta });
        else localStorage.removeItem(backupKey);
      }
    } catch {
      // storage unavailable: nothing to restore
    }
    setReady(true);
    // Only on first load: refreshes after saving must not replace the writer's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(() => payload(sections, meta), [sections, meta]);
  const dirty = ready && JSON.stringify(current) !== saved;

  // Keep unsaved work on this device and warn before leaving.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(backupKey, JSON.stringify({ sections, meta, baseVersion: doc.version?.versionNo ?? 0 }));
        else localStorage.removeItem(backupKey);
      } catch {
        // storage full or blocked
      }
    }, 800);
    return () => clearTimeout(t);
  }, [sections, meta, dirty, ready, backupKey, doc.version?.versionNo]);

  useEffect(() => {
    const warn = (ev: BeforeUnloadEvent) => {
      if (dirty) ev.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Live score while writing (rule engine only, no credits).
  const runAnalysis = useCallback(
    async (content: Content) => {
      const r = await apiAction<EditorAnalysis>('POST', `/user/editor/documents/${doc.id}/analyze`, content);
      if (r.ok) setAnalysis(r.data);
      return r;
    },
    [doc.id],
  );
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void runAnalysis(current), 1500);
    return () => clearTimeout(t);
  }, [current, ready, runAnalysis]);

  const commit = (next: Section[]) => {
    setHistory((h) => ({ past: [...h.past.slice(-49), sections], future: [] }));
    setSections(next);
  };
  const update = (id: string, patch: Partial<Section>) => commit(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const undo = () =>
    setHistory((h) => {
      if (!h.past.length) return h;
      setSections(h.past[h.past.length - 1]);
      return { past: h.past.slice(0, -1), future: [sections, ...h.future] };
    });
  const redo = () =>
    setHistory((h) => {
      if (!h.future.length) return h;
      const [next, ...rest] = h.future;
      setSections(next);
      return { past: [...h.past, sections], future: rest };
    });

  const addSection = (afterId = activeId) => {
    const idx = sections.findIndex((s) => s.id === afterId);
    const section: Section = { id: newId(), kind: 'h2', title: '', hint: 'New Section — Add a heading and content', body: '' };
    const next = [...sections];
    next.splice(idx + 1, 0, section);
    commit(next);
    setActiveId(section.id);
  };
  const move = (id: string, delta: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === id);
    const to = idx + delta;
    if (to < 2 || to >= sections.length || sections[idx].kind !== 'h2') return;
    const next = [...sections];
    [next[idx], next[to]] = [next[to], next[idx]];
    commit(next);
  };
  const remove = (id: string) => {
    if (sections.find((s) => s.id === id)?.kind !== 'h2') return;
    const next = sections.filter((s) => s.id !== id);
    commit(next);
    setActiveId(next[1]?.id ?? next[0].id);
  };

  /** Wraps or prefixes the selection in the active section's body (markdown). */
  const format = (kind: 'bold' | 'italic' | 'underline' | 'link' | 'image' | 'ul' | 'ol' | 'quote' | 'h3') => {
    const area = textareas.current[activeId];
    const section = sections.find((s) => s.id === activeId);
    if (!area || !section) return;
    const { selectionStart: a, selectionEnd: b, value } = area;
    const selected = value.slice(a, b) || 'text';
    const wrap = { bold: ['**', '**'], italic: ['*', '*'], underline: ['__', '__'], link: ['[', '](https://)'] } as const;
    let next: string;
    if (kind === 'image') next = `${value.slice(0, a)}![Describe the image](https://)${value.slice(b)}`;
    else if (kind in wrap) {
      const [l, r] = wrap[kind as keyof typeof wrap];
      next = value.slice(0, a) + l + selected + r + value.slice(b);
    } else {
      const prefix = kind === 'ul' ? '- ' : kind === 'ol' ? '1. ' : kind === 'h3' ? '### ' : '> ';
      const lineStart = value.lastIndexOf('\n', a - 1) + 1;
      next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    }
    update(activeId, { body: next });
    requestAnimationFrame(() => area.focus());
  };

  const run = (label: string, fn: () => Promise<string | void>) => {
    setError(null);
    setNotice(null);
    setBusy(label);
    start(async () => {
      try {
        const msg = await fn();
        if (msg) setNotice(msg);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(null);
      }
    });
  };

  const save = async () => {
    const r = await apiAction<{ versionNo: number; unchanged: boolean; analysis?: EditorAnalysis }>('PUT', `/user/editor/documents/${doc.id}/content`, current);
    if (!r.ok) throw new Error(r.message);
    setSaved(JSON.stringify(current));
    if (r.data.analysis) setAnalysis(r.data.analysis);
    try {
      localStorage.removeItem(backupKey);
    } catch {
      // ignore
    }
    router.refresh();
    return r.data.unchanged ? 'No changes to save.' : `Saved as version ${r.data.versionNo}.`;
  };

  const setStatus = (status: EditorDoc['status']) =>
    run('status', async () => {
      if (dirty) await save();
      const r = await apiAction('PATCH', `/user/editor/documents/${doc.id}`, { status });
      if (!r.ok) throw new Error(r.message);
      setMenu(null);
      router.refresh();
      return status === 'IN_REVIEW' ? 'Sent for review.' : status === 'ARCHIVED' ? 'Document archived.' : 'Status updated.';
    });

  const suggest = (body: { focus?: string; instruction?: string }) =>
    run('suggest', async () => {
      if (!doc.aiAvailable) throw new Error(AI_OFF);
      if (dirty) await save();
      const instruction = [TARGETS.find((t) => t.key === target)?.instruction, body.instruction].filter(Boolean).join(' ');
      const r = await apiAction('POST', `/user/editor/documents/${doc.id}/suggestions`, { ...(body.focus ? { focus: body.focus } : {}), ...(instruction ? { instruction: instruction.slice(0, 1000) } : {}) });
      if (!r.ok) throw new Error(r.message);
      router.refresh();
      return 'New suggestions are ready.';
    });

  const decide = (s: EditorSuggestion, status: 'ACCEPTED' | 'REJECTED') =>
    run(`decide:${s.id}`, async () => {
      if (status === 'ACCEPTED') {
        const original = s.original.trim();
        const isMetaTitle = /title/i.test(s.title) && !/description/i.test(s.title);
        if (s.type === 'METADATA' && (!original || meta.title.includes(original) || meta.metaDescription.includes(original))) {
          const text = s.replacement.replace(/<[^>]+>/g, '').trim();
          if (original && meta.title.includes(original)) setMeta((m) => ({ ...m, title: m.title.replace(original, text) }));
          else if (original && meta.metaDescription.includes(original)) setMeta((m) => ({ ...m, metaDescription: m.metaDescription.replace(original, text) }));
          else setMeta((m) => (isMetaTitle ? { ...m, title: text } : { ...m, metaDescription: text }));
        } else {
          const html = documentToHtml(sections);
          let next: string | null = null;
          if (!original) next = `${html}\n${s.replacement}`;
          else if (html.includes(original)) next = html.replace(original, s.replacement);
          else {
            // Match on visible text when the quote spans formatting.
            const doc2 = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
            const block = Array.from(doc2.body.querySelectorAll('p,li,h1,h2,h3,h4,blockquote')).find((el) => (el.textContent ?? '').includes(original));
            if (block) {
              block.innerHTML = (block.textContent ?? '').replace(original, s.replacement);
              next = doc2.body.innerHTML;
            }
          }
          if (next === null) throw new Error('The original text was not found in the current draft. Apply this change by hand, then reject the suggestion.');
          commit(htmlToSections(next));
        }
      }
      const r = await apiAction('PATCH', `/user/editor/suggestions/${s.id}`, { status });
      if (!r.ok) throw new Error(r.message);
      router.refresh();
      return status === 'ACCEPTED' ? 'Applied. Save to keep the change.' : undefined;
    });

  const loadVersion = (versionNo: number) =>
    run('version', async () => {
      const r = await apiQuery<EditorDoc>(`/user/editor/documents/${doc.id}?version=${versionNo}`);
      if (!r.ok) throw new Error(r.message);
      commit(htmlToSections(r.data.content?.html ?? ''));
      setMeta(metaOf(r.data.content, doc));
      setMenu(null);
      return `Loaded version ${versionNo}. Save to make it the latest version.`;
    });

  const [pub, setPub] = useState({ integrationId: connections[0]?.id ?? '', type: 'posts', status: 'draft' });
  const publish = () =>
    run('publish', async () => {
      if (dirty) await save();
      const r = await apiAction<{ link?: string | null; status?: string }>('POST', `/user/editor/documents/${doc.id}/publish`, pub);
      if (!r.ok) throw new Error(r.message);
      if (pub.status === 'publish') await apiAction('PATCH', `/user/editor/documents/${doc.id}`, { status: 'PUBLISHED' });
      router.refresh();
      return `Sent to WordPress as ${r.data.status ?? pub.status}${r.data.link ? `: ${r.data.link}` : '.'}`;
    });

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? sections.filter((s) => `${sectionLabel(s)} ${sectionHint(s)}`.toLowerCase().includes(term)) : sections;
  }, [filter, sections]);
  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  const html = useMemo(() => documentToHtml(sections), [sections]);
  const tagFor = (s: Section) => (s.kind === 'hero' ? <ImageIcon size={18} /> : s.kind === 'h1' ? 'H1' : 'H2');
  const insight = INSIGHT_CATEGORIES[insightTab];
  const issues = (analysis?.issues ?? []).filter((i) => insight.cats.includes(i.category));
  const pending = doc.suggestions.filter((s) => s.status === 'PENDING' && (!SUGGESTION_TABS[suggestionTab] || SUGGESTION_TABS[suggestionTab]!.includes(s.type)));
  const aiTitle = doc.aiAvailable ? 'Uses credits' : AI_OFF;
  const statusLabel = { DRAFT: 'Draft', IN_REVIEW: 'In review', PUBLISHED: 'Published', ARCHIVED: 'Archived' }[doc.status];

  if (!ready) return <p style={{ padding: 24, color: 'var(--muted)' }}>Loading document…</p>;

  return (
    <>
      <div className={e.head}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)' }}>On-Page SEO Editor</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            <Link href="/app/editor" style={{ color: 'var(--blue)' }}>
              All documents
            </Link>{' '}
            · {doc.title} · {statusLabel}
            {projectName ? ` · ${projectName}` : ''}
            {doc.pageUrl ? (
              <>
                {' · '}
                <a href={doc.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                  {doc.pageUrl}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className={e.headActions}>
          <div className={e.meta}>
            <span>
              {dirty ? <CircleAlert size={16} color="var(--amber)" /> : <CircleCheck size={16} color="var(--green)" />}
              {dirty ? 'Unsaved changes' : doc.version ? `Saved · version ${doc.version.versionNo}` : 'Not saved yet'}
            </span>
            <button type="button" className={e.linkBtn} onClick={() => setMenu(menu === 'history' ? null : 'history')} aria-expanded={menu === 'history'}>
              <History size={16} /> Version History ({doc.versions.length})
            </button>
          </div>
          <div className={e.buttons}>
            <Button variant="secondary" icon={<Eye size={18} />} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? 'Edit' : 'Preview'}
            </Button>
            <Button variant="secondary" icon={<RefreshCw size={18} />} onClick={() => run('analyze', async () => void (await runAnalysis(current)))} disabled={busy === 'analyze'}>
              Re-analyze
            </Button>
            <span className={e.split}>
              <Button onClick={() => run('save', save)} disabled={!!busy}>
                {busy === 'save' ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button aria-label="More save options" aria-expanded={menu === 'save'} onClick={() => setMenu(menu === 'save' ? null : 'save')}>
                <ChevronDown size={18} />
              </Button>
              {menu === 'save' && (
                <div className={e.menu} role="menu">
                  <button role="menuitem" onClick={() => setStatus('IN_REVIEW')} disabled={doc.status === 'IN_REVIEW'}>
                    Save & send for review
                  </button>
                  <button role="menuitem" onClick={() => setStatus('DRAFT')} disabled={doc.status === 'DRAFT'}>
                    Move back to draft
                  </button>
                  <button role="menuitem" onClick={() => setStatus('ARCHIVED')}>
                    Archive document
                  </button>
                </div>
              )}
            </span>
            <span className={e.dropdown}>
              <button className={e.iconBtn} aria-label="Publish options" aria-expanded={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')}>
                <MoreVertical size={20} />
              </button>
              {menu === 'more' && (
                <div className={e.menu} style={{ width: 300, padding: 12 }}>
                  <strong style={{ fontSize: 14 }}>Publish to WordPress</strong>
                  {connections.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0' }}>
                      No website connected. <Link href="/app/integrations/cms" style={{ color: 'var(--blue)' }}>Connect WordPress</Link>
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      <Select aria-label="Website" value={pub.integrationId} onChange={(ev) => setPub({ ...pub, integrationId: ev.target.value })}>
                        {connections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                      <Select aria-label="Content type" value={pub.type} onChange={(ev) => setPub({ ...pub, type: ev.target.value })}>
                        <option value="posts">Post</option>
                        <option value="pages">Page</option>
                      </Select>
                      <Select aria-label="WordPress status" value={pub.status} onChange={(ev) => setPub({ ...pub, status: ev.target.value })}>
                        <option value="draft">Save as WordPress draft</option>
                        <option value="publish">Publish live</option>
                      </Select>
                      <Button icon={<Send size={16} />} onClick={publish} disabled={!!busy}>
                        {busy === 'publish' ? 'Sending…' : 'Send to WordPress'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </span>
          </div>
        </div>
      </div>

      {(error || notice) && (
        <div style={{ marginBottom: 12 }}>
          <ActionMessage error={error} success={notice} />
        </div>
      )}
      {backup && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="neutral">
            Unsaved changes from an earlier session were found on this device.{' '}
            <button
              type="button"
              className={e.linkBtn}
              onClick={() => {
                commit(backup.sections);
                setMeta(backup.meta);
                setBackup(null);
              }}
            >
              Restore them
            </button>{' '}
            or{' '}
            <button
              type="button"
              className={e.linkBtn}
              onClick={() => {
                setBackup(null);
                try {
                  localStorage.removeItem(backupKey);
                } catch {
                  // ignore
                }
              }}
            >
              discard
            </button>
            .
          </Notice>
        </div>
      )}
      {menu === 'history' && (
        <div className={e.col} style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Version History</h3>
          {doc.versions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No saved versions yet.</p>
          ) : (
            doc.versions.map((v) => (
              <div key={v.id} className={e.checkRow}>
                <b>v{v.versionNo}</b> {new Date(v.createdAt).toLocaleString()} · {v.author}
                {v.versionNo === doc.version?.versionNo ? (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>Current</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => loadVersion(v.versionNo)} style={{ marginLeft: 'auto' }}>
                    Load
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div className={e.optimizeRow}>
        <div className={e.optimize} role="group" aria-label="Optimize for">
          <span>
            Optimize for: <Info size={16} color="var(--muted)" aria-label="AI suggestions focus on this goal." />
          </span>
          {TARGETS.map((t) => (
            <button key={t.key} type="button" className={`${e.seg} ${target === t.key ? e.segOn : ''}`} aria-pressed={target === t.key} onClick={() => setTarget(t.key)}>
              {t.icon}
              {t.key}
            </button>
          ))}
        </div>
        <div className={e.blurb}>Get AI-powered recommendations for search, content quality, and AI visibility — all in one place.</div>
      </div>

      <div className={e.col} style={{ padding: 16, marginBottom: 16 }}>
        <div className={e.metaGrid}>
          <label>
            <span>
              Title tag <small>{meta.title.length}/60</small>
            </span>
            <Input value={meta.title} maxLength={300} onChange={(ev) => setMeta({ ...meta, title: ev.target.value })} />
          </label>
          <label>
            <span>Focus keyword</span>
            <Input value={meta.focusKeyword} maxLength={200} onChange={(ev) => setMeta({ ...meta, focusKeyword: ev.target.value })} placeholder="e.g. seo audit checklist" />
          </label>
          <label className={e.wide}>
            <span>
              Meta description <small>{meta.metaDescription.length}/160</small>
            </span>
            <Textarea rows={2} value={meta.metaDescription} maxLength={500} onChange={(ev) => setMeta({ ...meta, metaDescription: ev.target.value })} />
          </label>
          <label>
            <span>URL slug</span>
            <Input value={meta.slug} maxLength={200} onChange={(ev) => setMeta({ ...meta, slug: ev.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} placeholder="seo-audit-checklist" />
          </label>
        </div>
      </div>

      <div className={e.layout}>
        {/* Outline */}
        <aside className={e.col} aria-label="Article outline">
          <div className={e.outlineHead}>
            <h2>
              <SquarePen size={20} color="var(--blue)" /> Article Outline
            </h2>
            <button className={e.iconBtn} aria-label={outlineOpen ? 'Collapse outline' : 'Expand outline'} onClick={() => setOutlineOpen((o) => !o)}>
              {outlineOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {outlineOpen && (
            <>
              <div className={e.outlineTools}>
                <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => addSection()} style={{ marginLeft: 'auto' }}>
                  Add Section
                </Button>
              </div>
              <div style={{ padding: '0 16px 12px' }}>
                <Input value={filter} onChange={(ev) => setFilter(ev.target.value)} placeholder="Search sections..." icon={<Search size={16} />} aria-label="Search sections" />
              </div>
              {visible.map((s) => (
                <div
                  key={s.id}
                  className={`${e.outlineItem} ${s.id === activeId ? e.outlineActive : ''}`}
                  onClick={() => setActiveId(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === 'Enter' && setActiveId(s.id)}
                  aria-current={s.id === activeId}
                >
                  <GripVertical size={16} className={e.grip} />
                  <span className={e.tag}>{tagFor(s)}</span>
                  <span className={e.outlineText}>
                    <strong>{sectionLabel(s)}</strong>
                    <span>{sectionHint(s)}</span>
                  </span>
                  {s.kind === 'h2' && (
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <button className={e.iconBtn} aria-label="Move up" onClick={(ev) => { ev.stopPropagation(); move(s.id, -1); }}>
                        <ArrowUp size={14} />
                      </button>
                      <button className={e.iconBtn} aria-label="Move down" onClick={(ev) => { ev.stopPropagation(); move(s.id, 1); }}>
                        <ArrowDown size={14} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </aside>

        {/* Canvas */}
        <section className={e.col} aria-label="Editor">
          <div className={e.editorTabs}>
            <button className={`${e.editorTab} ${panel === 'write' ? e.editorTabOn : ''}`} onClick={() => setPanel('write')}>
              Write
            </button>
            <button className={`${e.editorTab} ${panel === 'ask' ? e.editorTabOn : ''}`} onClick={() => setPanel('ask')} title={aiTitle}>
              Ask AI
            </button>
            <button className={e.editorTab} onClick={() => addSection()}>
              Insert section
            </button>
            <div className={e.view}>
              View:
              <button className={mode === 'visual' ? e.viewOn : ''} onClick={() => setMode('visual')}>
                Visual
              </button>
              <button className={mode === 'html' ? e.viewOn : ''} onClick={() => setMode('html')}>
                HTML
              </button>
            </div>
          </div>
          {panel === 'ask' && (
            <div style={{ padding: 12, borderBottom: '1px solid var(--line)', display: 'grid', gap: 8 }}>
              {!doc.aiAvailable && <Notice tone="neutral">{AI_OFF}</Notice>}
              <Textarea rows={2} value={ask} onChange={(ev) => setAsk(ev.target.value)} maxLength={900} placeholder="Ask for specific edits, e.g. “Add an FAQ answering the three most common questions about this topic.”" disabled={!doc.aiAvailable} />
              <div>
                <Button icon={<Sparkles size={16} />} disabled={!doc.aiAvailable || !ask.trim() || !!busy} onClick={() => suggest({ instruction: ask })}>
                  {busy === 'suggest' ? 'Thinking…' : 'Get Suggestions'}
                </Button>
              </div>
            </div>
          )}
          {mode === 'visual' && !preview && (
            <div className={e.toolbar} role="toolbar" aria-label="Formatting">
              <button className={e.tool} aria-label="Bold" onClick={() => format('bold')} disabled={active.kind === 'hero'}><Bold size={16} /></button>
              <button className={e.tool} aria-label="Italic" onClick={() => format('italic')} disabled={active.kind === 'hero'}><Italic size={16} /></button>
              <button className={e.tool} aria-label="Underline" onClick={() => format('underline')} disabled={active.kind === 'hero'}><Underline size={16} /></button>
              <span className={e.sep} />
              <button className={e.tool} aria-label="Subheading (H3)" onClick={() => format('h3')} disabled={active.kind === 'hero'}>H3</button>
              <button className={e.tool} aria-label="Bulleted list" onClick={() => format('ul')} disabled={active.kind === 'hero'}><List size={16} /></button>
              <button className={e.tool} aria-label="Numbered list" onClick={() => format('ol')} disabled={active.kind === 'hero'}><ListOrdered size={16} /></button>
              <button className={e.tool} aria-label="Quote" onClick={() => format('quote')} disabled={active.kind === 'hero'}><Quote size={16} /></button>
              <button className={e.tool} aria-label="Link" onClick={() => format('link')} disabled={active.kind === 'hero'}><Link2 size={16} /></button>
              <button className={e.tool} aria-label="Image" title="Insert an image by URL with alt text" onClick={() => format('image')} disabled={active.kind === 'hero'}><ImageIcon size={16} /></button>
              <span className={e.sep} />
              <button className={e.tool} aria-label="Undo" onClick={undo} disabled={!history.past.length}><Undo2 size={16} /></button>
              <button className={e.tool} aria-label="Redo" onClick={redo} disabled={!history.future.length}><Redo2 size={16} /></button>
            </div>
          )}

          {mode === 'html' ? (
            <pre className={e.html} aria-label="Generated HTML">{html}</pre>
          ) : preview ? (
            <div className={e.preview} dangerouslySetInnerHTML={{ __html: clean(html) }} />
          ) : (
            <div className={e.canvas}>
              {sections.map((s) => (
                <div key={s.id} className={`${e.block} ${s.id === activeId ? e.blockActive : ''}`} onFocusCapture={() => setActiveId(s.id)} onClick={() => setActiveId(s.id)}>
                  {s.kind === 'hero' ? (
                    <div className={e.hero}>
                      <div className={e.heroTop}>
                        <h3>
                          <ImageIcon size={18} color="var(--blue)" /> Hero Section <small style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</small>
                        </h3>
                        <Button variant="secondary" size="sm" icon={<WandSparkles size={14} />} disabled={!doc.aiAvailable || !!busy} title={aiTitle} onClick={() => suggest({ focus: 'CONTENT', instruction: 'Suggest a compelling hero headline and subheadline for this page.' })}>
                          Suggest with AI
                        </Button>
                      </div>
                      <input className={`${e.plainInput} ${e.h2Input}`} value={s.title} onChange={(ev) => update(s.id, { title: ev.target.value })} placeholder="Add a headline for your article" aria-label="Hero headline" />
                      <input className={e.plainInput} value={s.body} onChange={(ev) => update(s.id, { body: ev.target.value })} placeholder="Add a subheadline or short description" aria-label="Hero subheadline" style={{ fontSize: 16, color: 'var(--muted)' }} />
                      <Input value={s.cta ?? ''} onChange={(ev) => update(s.id, { cta: ev.target.value })} placeholder="CTA text (optional)" aria-label="Call to action text" style={{ maxWidth: 260 }} />
                    </div>
                  ) : (
                    <>
                      <span className={e.level}>{s.kind === 'h1' ? 'H1' : 'H2'}</span>
                      <div className={e.blockBody}>
                        <input
                          className={`${e.plainInput} ${s.kind === 'h1' ? e.h1Input : e.h2Input}`}
                          value={s.title}
                          onChange={(ev) => update(s.id, { title: ev.target.value })}
                          placeholder={s.kind === 'h1' ? 'Article Title' : sectionLabel({ ...s, title: '' })}
                          aria-label={s.kind === 'h1' ? 'Article title' : 'Section heading'}
                        />
                        <textarea
                          ref={(el) => {
                            textareas.current[s.id] = el;
                          }}
                          className={e.bodyInput}
                          value={s.body}
                          onChange={(ev) => update(s.id, { body: ev.target.value })}
                          placeholder={s.kind === 'h1' ? 'Add an introduction that answers the main question directly.' : `Write the ${sectionHint(s).toLowerCase()} for this section.`}
                          aria-label={`${sectionLabel(s)} content`}
                        />
                      </div>
                      {s.kind === 'h2' && (
                        <button className={e.iconBtn} aria-label="Delete section" onClick={() => remove(s.id)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
              <Button variant="ghost" icon={<Plus size={16} />} onClick={() => addSection(sections[sections.length - 1].id)}>
                Add Section
              </Button>
            </div>
          )}
        </section>

        {/* Insights */}
        <aside className={e.insights} aria-label="Optimization insights">
          <div className={e.col} style={{ padding: 16 }}>
            <h2 style={{ fontSize: 17, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Sparkles size={20} color="var(--blue)" /> Optimization Insights
            </h2>
            <div className={e.insightTabs}>
              {(['SEO', 'Content', 'AI Search (GEO)'] as const).map((t) => (
                <button key={t} className={insightTab === t ? e.on : ''} onClick={() => setInsightTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className={e.score}>
              <span className={e.scoreRing}>{analysis ? insight.score(analysis.scores) : '—'}</span>
              <div>
                <strong style={{ color: 'var(--heading)' }}>{analysis ? `${insightTab} score` : 'Not analyzed yet'}</strong>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {analysis ? `${analysis.wordCount.toLocaleString()} words · ${analysis.readingMinutes} min read · overall ${analysis.scores.overall}/100` : 'Start writing to see your score.'}
                </p>
              </div>
            </div>
            {analysis?.keyword && insightTab === 'SEO' && (
              <div className={e.checkRow} style={{ flexWrap: 'wrap' }}>
                <b>“{analysis.keyword.keyword}”</b>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  title {analysis.keyword.inTitle ? '✓' : '✗'} · meta {analysis.keyword.inMeta ? '✓' : '✗'} · H1 {analysis.keyword.inH1 ? '✓' : '✗'} · {analysis.keyword.occurrences}× ({analysis.keyword.density}%)
                </span>
              </div>
            )}
            {analysis && issues.length === 0 && (
              <div className={e.checkRow}>
                <CircleCheck size={16} color="var(--green)" /> No {insightTab} issues found
              </div>
            )}
            {issues.map((i) => (
              <details key={i.ruleKey} className={e.issue}>
                <summary className={e.checkRow}>
                  <CircleAlert size={16} color={i.severity === 'CRITICAL' || i.severity === 'HIGH' ? '#e11d48' : 'var(--amber)'} /> {i.title} <ChevronRight size={16} />
                </summary>
                <p>{i.guidance}</p>
              </details>
            ))}
            <Button block icon={<Play size={16} />} style={{ marginTop: 12 }} onClick={() => run('analyze', async () => void (await runAnalysis(current)))} disabled={busy === 'analyze'}>
              Run Analysis
            </Button>
          </div>

          <div className={e.col} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Lightbulb size={18} color="var(--amber)" /> Content Suggestions
              </h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{doc.suggestions.filter((s) => s.status === 'PENDING').length} pending</span>
            </div>
            <div className={e.insightTabs}>
              {Object.keys(SUGGESTION_TABS).map((t) => (
                <button key={t} className={suggestionTab === t ? e.on : ''} onClick={() => setSuggestionTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            {pending.length === 0 ? (
              <EmptyState
                compact
                icon={<Clipboard size={22} />}
                title="No suggestions yet"
                description={doc.aiAvailable ? 'Ask AI for suggestions; you accept or reject each one.' : AI_OFF}
                action={
                  <Button size="sm" icon={<Sparkles size={14} />} disabled={!doc.aiAvailable || !!busy} title={aiTitle} onClick={() => suggest({})}>
                    {busy === 'suggest' ? 'Thinking…' : 'Get Suggestions'}
                  </Button>
                }
              />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {pending.map((s) => (
                  <div key={s.id} className={e.suggestion}>
                    <strong>{s.title}</strong>
                    <small>{s.type.toLowerCase()}</small>
                    <p>{s.explanation}</p>
                    {s.original && <del>{s.original}</del>}
                    <ins dangerouslySetInnerHTML={{ __html: clean(s.replacement) }} />
                    <span style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => decide(s, 'ACCEPTED')} disabled={!!busy}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(s, 'REJECTED')} disabled={!!busy}>
                        Reject
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={e.col} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 16 }}>Actions for This Section</h3>
              <span style={{ fontSize: 12, color: 'var(--blue)' }}>{sectionLabel(active)}</span>
            </div>
            <div className={e.actionGrid}>
              {SECTION_ACTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={e.mini}
                  disabled={!doc.aiAvailable || !!busy || active.kind === 'hero'}
                  title={aiTitle}
                  onClick={() => suggest({ focus: 'CONTENT', instruction: `${a === 'Change Tone' ? 'Adjust the tone of' : a} the section titled “${sectionLabel(active)}”. Only change that section.` })}
                >
                  <WandSparkles size={14} /> {a}
                </button>
              ))}
            </div>
          </div>

          <div className={e.col} style={{ padding: 16 }}>
            <h3 style={{ fontSize: 16, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <Zap size={18} /> Quick Actions
            </h3>
            <div className={e.quickGrid}>
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className={e.mini}
                  disabled={!!busy || (!q.analyze && !doc.aiAvailable)}
                  title={q.analyze ? undefined : aiTitle}
                  onClick={() => {
                    if (q.analyze) {
                      setInsightTab('SEO');
                      run('analyze', async () => void (await runAnalysis(current)));
                    } else suggest({ focus: q.focus, instruction: q.instruction });
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
            {!doc.aiAvailable && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>{AI_OFF}</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
