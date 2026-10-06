'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
  Pencil,
  Play,
  Plus,
  Quote,
  RefreshCw,
  Search,
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
import { Button, EmptyState, Input, Notice } from '@/components/ui';
import { documentToHtml, newId, sectionHint, sectionLabel, starterOutline, type Section } from './model';
import e from './editor.module.css';

type Target = 'SEO' | 'Content' | 'AI Search (GEO)' | 'All';
const TARGETS: { key: Target; icon: React.ReactNode }[] = [
  { key: 'SEO', icon: <Search size={18} /> },
  { key: 'Content', icon: <FileText size={18} /> },
  { key: 'AI Search (GEO)', icon: <Sparkles size={18} /> },
  { key: 'All', icon: <CircleCheck size={18} /> },
];
const CHECKS = ['Title & Meta Description', 'Headings (H1, H2, H3)', 'Keyword Usage', 'Content Depth', 'Readability', 'Internal Links', 'Images (Alt Text)', 'Schema Markup', 'Technical SEO'];
const NOT_AVAILABLE = 'AI assistance and analysis are not available yet';

/**
 * Section-based page editor. Content is kept as a local draft in this browser
 * (per project) until the editor API exists; AI actions and analysis are
 * disabled rather than simulated (guide §7: suggestions are advisory records).
 */
export function SeoEditor({ projectId, projectName }: { projectId: string | null; projectName: string | null }) {
  const storageKey = `av-editor-draft:${projectId ?? 'none'}`;
  const [sections, setSections] = useState<Section[]>(() => starterOutline());
  const [activeId, setActiveId] = useState<string>(() => sections[0].id);
  const [history, setHistory] = useState<{ past: Section[][]; future: Section[][] }>({ past: [], future: [] });
  const [target, setTarget] = useState<Target>('SEO');
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [preview, setPreview] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [filter, setFilter] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [insightTab, setInsightTab] = useState<'SEO' | 'Content' | 'AI Search (GEO)'>('SEO');
  const [suggestionTab, setSuggestionTab] = useState('All');
  const loaded = useRef(false);
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Restore and autosave the local draft.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as { sections: Section[]; savedAt: string };
        if (Array.isArray(draft.sections) && draft.sections.length) {
          setSections(draft.sections);
          setActiveId(draft.sections[0].id);
          setSavedAt(new Date(draft.savedAt));
        }
      }
    } catch {
      // corrupt or unavailable storage: start fresh
    }
    loaded.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        const now = new Date();
        localStorage.setItem(storageKey, JSON.stringify({ sections, savedAt: now.toISOString() }));
        setSavedAt(now);
      } catch {
        // storage full or blocked: keep editing in memory
      }
    }, 800);
    return () => clearTimeout(t);
  }, [sections, storageKey]);

  const commit = (next: Section[]) => {
    setHistory((h) => ({ past: [...h.past.slice(-49), sections], future: [] }));
    setSections(next);
  };
  const update = (id: string, patch: Partial<Section>) => commit(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const undo = () =>
    setHistory((h) => {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      setSections(prev);
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
    if (to < 1 || to >= sections.length || sections[idx].kind === 'hero') return;
    const next = [...sections];
    [next[idx], next[to]] = [next[to], next[idx]];
    commit(next);
  };
  const remove = (id: string) => {
    if (sections.find((s) => s.id === id)?.kind !== 'h2') return;
    const next = sections.filter((s) => s.id !== id);
    commit(next);
    setActiveId(next[0].id);
  };

  /** Wraps or prefixes the selection in the active section's body (markdown). */
  const format = (kind: 'bold' | 'italic' | 'underline' | 'link' | 'ul' | 'ol' | 'quote') => {
    const area = textareas.current[activeId];
    const section = sections.find((s) => s.id === activeId);
    if (!area || !section) return;
    const { selectionStart: a, selectionEnd: b, value } = area;
    const selected = value.slice(a, b) || 'text';
    const wrap = { bold: ['**', '**'], italic: ['*', '*'], underline: ['__', '__'], link: ['[', '](https://)'] } as const;
    let next: string;
    if (kind in wrap) {
      const [l, r] = wrap[kind as keyof typeof wrap];
      next = value.slice(0, a) + l + selected + r + value.slice(b);
    } else {
      const prefix = kind === 'ul' ? '- ' : kind === 'ol' ? '1. ' : '> ';
      const lineStart = value.lastIndexOf('\n', a - 1) + 1;
      next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    }
    update(activeId, { body: next });
    requestAnimationFrame(() => area.focus());
  };

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? sections.filter((s) => `${sectionLabel(s)} ${sectionHint(s)}`.toLowerCase().includes(term)) : sections;
  }, [filter, sections]);
  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  const html = useMemo(() => documentToHtml(sections), [sections]);
  const tagFor = (s: Section) => (s.kind === 'hero' ? <ImageIcon size={18} /> : s.kind === 'h1' ? 'H1' : 'H2');

  return (
    <>
      <div className={e.head}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)' }}>On-Page SEO Editor</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            Create, optimize, and publish content that ranks and converts.{projectName ? ` Project: ${projectName}.` : ''}
          </p>
        </div>
        <div className={e.headActions}>
          <div className={e.meta}>
            <span>
              <CircleCheck size={16} color={savedAt ? 'var(--green)' : 'var(--subtle)'} />
              {savedAt ? `Draft saved on this device ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}
            </span>
            <span title="Version history is available once drafts are saved to your project">
              <History size={16} /> Version History
            </span>
          </div>
          <div className={e.buttons}>
            <Button variant="secondary" icon={<Eye size={18} />} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? 'Edit' : 'Preview'}
            </Button>
            <Button variant="secondary" icon={<RefreshCw size={18} />} disabled title={NOT_AVAILABLE}>
              Re-analyze
            </Button>
            <span className={e.split}>
              <Button disabled title={projectId ? 'Saving to your project is not available yet' : 'Select a project to save'}>
                Save Changes
              </Button>
              <Button disabled aria-label="More save options">
                <ChevronDown size={18} />
              </Button>
            </span>
            <button className={e.iconBtn} aria-label="More options" disabled>
              <MoreVertical size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className={e.optimizeRow}>
        <div className={e.optimize} role="group" aria-label="Optimize for">
          <span>
            Optimize for: <Info size={16} color="var(--muted)" />
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

      {!projectId && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="neutral">No project is selected. Your draft is kept on this device; select a project in the top bar to work on its pages.</Notice>
        </div>
      )}

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
            <button className={`${e.editorTab} ${e.editorTabOn}`}>Write</button>
            <button className={e.editorTab} disabled title={NOT_AVAILABLE}>
              Improve
            </button>
            <button className={e.editorTab} disabled title={NOT_AVAILABLE}>
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
          {mode === 'visual' && !preview && (
            <div className={e.toolbar} role="toolbar" aria-label="Formatting">
              <button className={e.tool} aria-label="Bold" onClick={() => format('bold')} disabled={active.kind === 'hero'}><Bold size={16} /></button>
              <button className={e.tool} aria-label="Italic" onClick={() => format('italic')} disabled={active.kind === 'hero'}><Italic size={16} /></button>
              <button className={e.tool} aria-label="Underline" onClick={() => format('underline')} disabled={active.kind === 'hero'}><Underline size={16} /></button>
              <span className={e.sep} />
              <button className={e.tool} aria-label="Bulleted list" onClick={() => format('ul')} disabled={active.kind === 'hero'}><List size={16} /></button>
              <button className={e.tool} aria-label="Numbered list" onClick={() => format('ol')} disabled={active.kind === 'hero'}><ListOrdered size={16} /></button>
              <button className={e.tool} aria-label="Quote" onClick={() => format('quote')} disabled={active.kind === 'hero'}><Quote size={16} /></button>
              <button className={e.tool} aria-label="Link" onClick={() => format('link')} disabled={active.kind === 'hero'}><Link2 size={16} /></button>
              <button className={e.tool} aria-label="Image" disabled title="Image upload is not available yet"><ImageIcon size={16} /></button>
              <span className={e.sep} />
              <button className={e.tool} aria-label="Align left" disabled><AlignLeft size={16} /></button>
              <button className={e.tool} aria-label="Align center" disabled><AlignCenter size={16} /></button>
              <button className={e.tool} aria-label="Align right" disabled><AlignRight size={16} /></button>
              <span className={e.sep} />
              <button className={e.tool} aria-label="Undo" onClick={undo} disabled={!history.past.length}><Undo2 size={16} /></button>
              <button className={e.tool} aria-label="Redo" onClick={redo} disabled={!history.future.length}><Redo2 size={16} /></button>
            </div>
          )}

          {mode === 'html' ? (
            <pre className={e.html} aria-label="Generated HTML">{html}</pre>
          ) : preview ? (
            <div className={e.preview} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className={e.canvas}>
              {sections.map((s) => (
                <div key={s.id} className={`${e.block} ${s.id === activeId ? e.blockActive : ''}`} onFocusCapture={() => setActiveId(s.id)} onClick={() => setActiveId(s.id)}>
                  {s.kind === 'hero' ? (
                    <div className={e.hero}>
                      <div className={e.heroTop}>
                        <h3>
                          <ImageIcon size={18} color="var(--blue)" /> Hero Section
                        </h3>
                        <span style={{ display: 'flex', gap: 6 }}>
                          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} disabled title="Image upload is not available yet">Edit</Button>
                          <Button variant="secondary" size="sm" icon={<WandSparkles size={14} />} disabled title={NOT_AVAILABLE}>Generate with AI</Button>
                        </span>
                      </div>
                      <div className={e.imageDrop}>
                        <ImageIcon size={28} />
                        Add a hero image (optional)
                        <span style={{ fontSize: 12 }}>Recommended size: 1200 × 630 px</span>
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
                          placeholder={s.kind === 'h1' ? 'Add a clear, descriptive title for your content' : `Write the ${sectionHint(s).toLowerCase()} for this section.`}
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
              <span className={e.scoreRing}>—</span>
              <div>
                <strong style={{ color: 'var(--heading)' }}>Not analyzed yet</strong>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Run analysis to see your {insightTab} score and insights.</p>
              </div>
            </div>
            {CHECKS.map((c) => (
              <div key={c} className={e.checkRow}>
                <CircleCheck size={16} color="var(--subtle)" /> {c} <ChevronRight size={16} />
              </div>
            ))}
            <Button block icon={<Play size={16} />} disabled title={NOT_AVAILABLE} style={{ marginTop: 12 }}>
              Run Analysis
            </Button>
          </div>

          <div className={e.col} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Lightbulb size={18} color="var(--amber)" /> Content Suggestions
              </h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Not analyzed yet</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 10px' }}>Run an audit to get personalized suggestions for your content.</p>
            <div className={e.insightTabs}>
              {['All', 'Missing Sections', 'Related Questions'].map((t) => (
                <button key={t} className={suggestionTab === t ? e.on : ''} onClick={() => setSuggestionTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <EmptyState compact icon={<Clipboard size={22} />} title="No suggestions yet" description="Run an audit to see content recommendations based on your page and target audience." />
          </div>

          <div className={e.col} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 16 }}>Actions for This Section</h3>
              <span style={{ fontSize: 12, color: 'var(--blue)' }}>{sectionLabel(active)}</span>
            </div>
            <div className={e.actionGrid}>
              {['Improve', 'Expand', 'Shorten', 'Rewrite', 'Change Tone', 'Generate Image'].map((a) => (
                <span key={a} className={e.mini} title={NOT_AVAILABLE}>
                  <WandSparkles size={14} /> {a}
                </span>
              ))}
            </div>
          </div>

          <div className={e.col} style={{ padding: 16 }}>
            <h3 style={{ fontSize: 16, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <Zap size={18} /> Quick Actions
            </h3>
            <div className={e.quickGrid}>
              {['Generate Meta Description', 'Optimize for AI Search (GEO)', 'Improve Writing', 'Add / Manage Citations', 'Check SEO Issues', 'Suggest Internal Links'].map((a) => (
                <span key={a} className={e.mini} title={NOT_AVAILABLE}>
                  {a}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>AI actions will be available here soon.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
