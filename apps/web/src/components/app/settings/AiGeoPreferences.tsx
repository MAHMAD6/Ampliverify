'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiAction } from '@/lib/actions';
import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  Database,
  SlidersHorizontal,
  Target,
  ChevronUp,
  Clock3,
  Coins,
  FileText,
  Info,
  Layers,
  MapPin,
  RotateCcw,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Button, ButtonLink, Select } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import s from './ai-geo.module.css';

type Platform = { key: string; name: string };
type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type Prefs = {
  platforms: string[];
  location: string;
  language: string;
  frequency: Frequency;
  citations: { track: boolean; authority: boolean; snippets: boolean };
  competitors: { enabled: boolean; citations: boolean; compare: boolean };
  depth: 'LIGHT' | 'STANDARD' | 'DEEP';
  focus: string[];
  credits: { notifyLow: boolean; monthlyLimit: boolean };
  tone: string;
  detail: string;
  style: string;
};

type Group = 'providers' | 'behavior' | 'geo' | 'credits';

/** Defaults shown by the design ("Weekly — Recommended", "Standard (Recommended)"); nothing else pre-selected. */
const DEFAULTS: Prefs = {
  platforms: [],
  location: '',
  language: '',
  frequency: 'WEEKLY',
  citations: { track: false, authority: false, snippets: false },
  competitors: { enabled: false, citations: false, compare: false },
  depth: 'STANDARD',
  focus: [],
  credits: { notifyLow: false, monthlyLimit: false },
  tone: '',
  detail: '',
  style: '',
};

const TONES = ['Professional', 'Friendly', 'Conversational', 'Formal'];
const DETAIL = ['Concise', 'Balanced', 'Detailed'];
const STYLES = ['Paragraphs', 'Bullet points', 'Mixed'];

const FREQUENCIES: { key: Frequency; label: string; text: string; recommended?: boolean }[] = [
  { key: 'DAILY', label: 'Daily', text: 'More frequent updates (uses more credits)' },
  { key: 'WEEKLY', label: 'Weekly', text: 'Good balance of insights and credit usage', recommended: true },
  { key: 'MONTHLY', label: 'Monthly', text: 'Lower credit usage' },
];
const FOCUS = ['Content relevance', 'Topic coverage', 'Brand sentiment', 'Competitive positioning'];

function Section({ icon, title, text, children, aside }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className={s.section}>
      <span className={s.icon}>{icon}</span>
      <div className={s.sectionBody}>
        <div className={s.sectionHead}>
          <div>
            <h3>
              {title} <Info size={14} className={s.info} aria-hidden />
            </h3>
            <p>{text}</p>
          </div>
          {aside}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Collapsible preference group (design: AI & GEO Preferences overview, docs/INPUTS.md #66). */
function Group({ id, icon, title, text, open, onToggle, children }: { id: string; icon: React.ReactNode; title: string; text: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className={s.group} aria-labelledby={`grp-${id}`}>
      <div className={s.groupHead}>
        <span className={s.groupIcon}>{icon}</span>
        <div>
          <h3 id={`grp-${id}`}>{title}</h3>
          <p>{text}</p>
        </div>
        <button type="button" className={s.collapse} aria-expanded={open} aria-controls={`grp-body-${id}`} aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`} onClick={onToggle}>
          {open ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
        </button>
      </div>
      {open && (
        <div id={`grp-body-${id}`} className={s.groupBody}>
          {children}
        </div>
      )}
    </section>
  );
}

function EmptyRow({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action: React.ReactNode }) {
  return (
    <div className={s.emptyRow}>
      <span className={s.emptyRowIcon}>{icon}</span>
      <span className={s.emptyRowText}>
        <b>{title}</b>
        <small>{text}</small>
      </span>
      {action}
    </div>
  );
}

function ToggleRow({ label, text, checked, onChange }: { label: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={s.toggleRow}>
      <Toggle label={label} checked={checked} onChange={onChange} />
      <span>
        <b>{label}</b>
        <small>{text}</small>
      </span>
    </div>
  );
}

/**
 * AI & GEO Preferences: overview with four collapsible groups (docs/INPUTS.md
 * #66); "Configure" opens the detailed forms from the earlier design (#64).
 * Tracking platforms come from
 * the GEO platform registry (`GET /public/geo-platforms`); locations and
 * languages from the shared lists. Saved to the workspace settings
 * (`settings.aiGeo`), which GEO checks use for default platforms and locale.
 */
export function AiGeoPreferences({
  platforms,
  locations,
  languages,
  initial,
  workspaceId,
  canEdit = true,
}: {
  platforms: Platform[];
  locations: string[];
  languages: string[];
  initial?: Partial<Prefs> | null;
  workspaceId?: string | null;
  canEdit?: boolean;
}) {
  const saved: Prefs = { ...DEFAULTS, ...(initial ?? {}) };
  const [prefs, setPrefs] = useState<Prefs>(saved);
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ error?: string; ok?: string }>({});
  const save = () =>
    startSave(async () => {
      if (!workspaceId) return;
      setSaveMsg({});
      const r = await apiAction('PATCH', `/user/workspaces/${workspaceId}`, {
        settings: {
          aiGeo: {
            defaultPlatforms: prefs.platforms,
            ...(prefs.location ? { defaultCountry: prefs.location.slice(0, 10) } : {}),
            ...(prefs.language ? { defaultLanguage: prefs.language.slice(0, 10) } : {}),
            checkFrequency: prefs.frequency,
            ...(prefs.tone ? { aiTone: prefs.tone } : {}),
            preferences: prefs,
          },
        },
      });
      if (!r.ok) return setSaveMsg({ error: r.message });
      setSaveMsg({ ok: 'Preferences saved.' });
      setEditing({});
      router.refresh();
    });
  const [openGroups, setOpenGroups] = useState<Record<Group, boolean>>({ providers: true, behavior: true, geo: true, credits: true });
  const [editing, setEditing] = useState<Partial<Record<Group, boolean>>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => pickerRef.current && !pickerRef.current.contains(e.target as Node) && setPickerOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPickerOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [pickerOpen]);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) => setPrefs((p) => ({ ...p, [key]: value }));
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  const selected = platforms.filter((p) => prefs.platforms.includes(p.key));

  const open = (key: Group) => setOpenGroups((o) => ({ ...o, [key]: !o[key] }));
  const configure = (key: Group) => {
    setEditing((e) => ({ ...e, [key]: true }));
    setOpenGroups((o) => ({ ...o, [key]: true }));
  };
  const anyEditing = Object.values(editing).some(Boolean);

  return (
    <>
      <div className={s.titleRow}>
        <div>
          <h2>AI &amp; GEO Preferences</h2>
          <p>Configure your AI providers, GEO monitoring preferences, and how AI features work across AmpliVerify.</p>
        </div>
        {anyEditing && (
          <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setPrefs(DEFAULTS)} disabled={!dirty}>
            Restore Defaults
          </Button>
        )}
      </div>

      <div className={s.groups}>
        <Group
          id="providers"
          icon={<Settings size={26} />}
          title="AI Provider Settings"
          text="Choose and manage AI providers for content generation, analysis, and recommendations."
          open={openGroups.providers}
          onToggle={() => open('providers')}
        >
          <EmptyRow
            icon={<Bot size={30} />}
            title="No AI providers configured"
            text="Connect an AI provider to enable AI-powered features."
            action={
              <ButtonLink href="/app/settings/integrations" variant="outline">
                Configure Providers
              </ButtonLink>
            }
          />
        </Group>

        <Group
          id="behavior"
          icon={<SlidersHorizontal size={26} />}
          title="Default AI Behavior"
          text="Set how AI should generate content, provide recommendations, and respond."
          open={openGroups.behavior}
          onToggle={() => open('behavior')}
        >
          {editing.behavior ? (
            <div className={s.grid}>
              <Section icon={<FileText size={22} />} title="Writing Style" text="Tone, detail level and output style for AI-generated content.">
                <div className={s.two}>
                  <label className={s.field}>
                    <span>Tone</span>
                    <Select value={prefs.tone} onChange={(e) => set('tone', e.target.value)}>
                      <option value="">Select a tone</option>
                      {TONES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </label>
                  <label className={s.field}>
                    <span>Detail Level</span>
                    <Select value={prefs.detail} onChange={(e) => set('detail', e.target.value)}>
                      <option value="">Select a detail level</option>
                      {DETAIL.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </label>
                  <label className={s.field}>
                    <span>Output Style</span>
                    <Select value={prefs.style} onChange={(e) => set('style', e.target.value)}>
                      <option value="">Select an output style</option>
                      {STYLES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                  </label>
                </div>
              </Section>
            <Section icon={<Sparkles size={22} />} title="AI Analysis Preferences" text="Customize how AI analyzes and interprets your results.">
              <div className={s.two}>
                <label className={s.field}>
                  <span>Analysis Depth</span>
                  <Select value={prefs.depth} onChange={(e) => set('depth', e.target.value as Prefs['depth'])}>
                    <option value="LIGHT">Light</option>
                    <option value="STANDARD">Standard (Recommended)</option>
                    <option value="DEEP">Deep</option>
                  </Select>
                  <small>Deeper analysis uses more credits.</small>
                </label>
                <fieldset className={s.field}>
                  <legend>Focus Areas (Select all that apply)</legend>
                  <div className={s.checks}>
                    {FOCUS.map((f) => (
                      <label key={f}>
                        <input type="checkbox" checked={prefs.focus.includes(f)} onChange={(e) => set('focus', e.target.checked ? [...prefs.focus, f] : prefs.focus.filter((x) => x !== f))} /> {f}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </Section>
            </div>
          ) : (
            <EmptyRow
              icon={<FileText size={30} />}
              title="No default AI behavior set"
              text="Choose your preferred tone, detail level, and output style."
              action={
                <Button variant="outline" onClick={() => configure('behavior')}>
                  Set Preferences
                </Button>
              }
            />
          )}
        </Group>

        <Group
          id="geo"
          icon={<Target size={26} />}
          title="GEO Monitoring Preferences"
          text="Configure default settings for AI search (GEO) monitoring."
          open={openGroups.geo}
          onToggle={() => open('geo')}
        >
          {editing.geo ? (
            <div className={s.grid}>
            <Section
              icon={<Layers size={22} />}
              title="Tracking Platforms"
              text="Select which AI search platforms to track by default."
              aside={
                <div className={s.pickerWrap} ref={pickerRef}>
                  <span className={s.count}>{selected.length} selected</span>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-expanded={pickerOpen}
                    aria-haspopup="dialog"
                    disabled={platforms.length === 0}
                    onClick={() => {
                      setDraft(prefs.platforms);
                      setPickerOpen((o) => !o);
                    }}
                  >
                    Select Platforms {pickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </Button>
                  {pickerOpen && (
                    <div className={s.picker} role="dialog" aria-label="Select AI search platforms">
                      <div className={s.pickerHead}>
                        <b>Select AI Search Platforms</b>
                        <button type="button" aria-label="Close" onClick={() => setPickerOpen(false)}>
                          <X size={16} />
                        </button>
                      </div>
                      <p>Choose the platforms to track. No account connection is required.</p>
                      {platforms.map((p) => (
                        <label key={p.key} className={s.pickItem}>
                          <input
                            type="checkbox"
                            checked={draft.includes(p.key)}
                            onChange={(e) => setDraft((d) => (e.target.checked ? [...d, p.key] : d.filter((k) => k !== p.key)))}
                          />
                          <span className={s.mono}>{p.name.charAt(0)}</span>
                          {p.name}
                        </label>
                      ))}
                      <div className={s.pickerActions}>
                        <Button variant="outline" size="sm" onClick={() => setPickerOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            set('platforms', draft);
                            setPickerOpen(false);
                          }}
                        >
                          Apply ({draft.length} selected)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              }
            >
              {platforms.length === 0 ? (
                <div className={s.empty}>No AI search platforms are available yet.</div>
              ) : selected.length === 0 ? (
                <div className={s.empty}>
                  <b>No platforms selected yet</b>
                  <small>Choose the AI search platforms you want to track.</small>
                </div>
              ) : (
                <ul className={s.chips}>
                  {selected.map((p) => (
                    <li key={p.key}>
                      <span className={s.mono}>{p.name.charAt(0)}</span>
                      {p.name}
                      <button type="button" aria-label={`Remove ${p.name}`} onClick={() => set('platforms', prefs.platforms.filter((k) => k !== p.key))}>
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section icon={<MapPin size={22} />} title="Location & Language" text="Set the default location and language for AI search tracking.">
              <div className={s.two}>
                <label className={s.field}>
                  <span>Country / Location</span>
                  <Select value={prefs.location} onChange={(e) => set('location', e.target.value)}>
                    <option value="">Select a country or region</option>
                    {locations.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </Select>
                  <small>Used to simulate local AI search results.</small>
                </label>
                <label className={s.field}>
                  <span>Language</span>
                  <Select value={prefs.language} onChange={(e) => set('language', e.target.value)}>
                    <option value="">Select a language</option>
                    {languages.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </Select>
                  <small>Used for prompts and result analysis.</small>
                </label>
              </div>
            </Section>
            <Section icon={<Clock3 size={22} />} title="Check Frequency" text="Set how often to run visibility checks for your projects.">
              <div className={s.radios} role="radiogroup" aria-label="Check frequency">
                {FREQUENCIES.map((f) => (
                  <label key={f.key} className={s.radio}>
                    <input type="radio" name="frequency" checked={prefs.frequency === f.key} onChange={() => set('frequency', f.key)} />
                    <span>
                      <b>
                        {f.label} {f.recommended && <em className={s.badge}>Recommended</em>}
                      </b>
                      <small>{f.text}</small>
                    </span>
                  </label>
                ))}
              </div>
            </Section>
            <Section icon={<FileText size={22} />} title="Citations & Sources" text="Choose how to track and analyze citations and sources.">
              <ToggleRow label="Track citations and sources" text="Identify where your brand is mentioned and linked." checked={prefs.citations.track} onChange={(v) => set('citations', { ...prefs.citations, track: v })} />
              <ToggleRow label="Track source authority" text="Analyze the authority of citing sources." checked={prefs.citations.authority} onChange={(v) => set('citations', { ...prefs.citations, authority: v })} />
              <ToggleRow label="Include source snippets" text="Save relevant snippets for each citation." checked={prefs.citations.snippets} onChange={(v) => set('citations', { ...prefs.citations, snippets: v })} />
            </Section>
            <Section icon={<Users size={22} />} title="Competitor Monitoring" text="Set default preferences for competitor analysis.">
              <ToggleRow label="Enable competitor monitoring" text="Track competitor visibility and mentions." checked={prefs.competitors.enabled} onChange={(v) => set('competitors', { ...prefs.competitors, enabled: v })} />
              <ToggleRow label="Include competitor citations" text="Analyze sources citing your competitors." checked={prefs.competitors.citations} onChange={(v) => set('competitors', { ...prefs.competitors, citations: v })} />
              <ToggleRow label="Compare side-by-side" text="Show direct comparison in results." checked={prefs.competitors.compare} onChange={(v) => set('competitors', { ...prefs.competitors, compare: v })} />
            </Section>
            <Section icon={<FileText size={22} />} title="Default Settings for New Projects" text="These preferences will be applied to all new projects. You can override them in each project.">
              <div className={s.defaults}>
                <Settings size={20} />
                <span>
                  <b>Using global defaults</b>
                  <small>These settings will be applied to new projects until you customize them.</small>
                </span>
                <Link href="/app/settings/project-defaults" className={s.review}>
                  Review Defaults
                </Link>
              </div>
            </Section>
            </div>
          ) : (
            <EmptyRow
              icon={<BarChart3 size={30} />}
              title="No GEO preferences set"
              text="Choose your preferred monitoring frequency and search sources."
              action={
                <Button variant="outline" onClick={() => configure('geo')}>
                  Configure GEO
                </Button>
              }
            />
          )}
        </Group>

        <Group
          id="credits"
          icon={<Database size={26} />}
          title="Usage &amp; Credit Preferences"
          text="Set credit usage preferences and alerts."
          open={openGroups.credits}
          onToggle={() => open('credits')}
        >
          {editing.credits ? (
            <div className={s.grid}>
            <Section icon={<Coins size={22} />} title="Credit Usage Controls" text="Set limits and notifications for credit usage.">
              <div className={s.two}>
                <ToggleRow label="Notify when credits are low" text="Get notified when your credit balance is running low." checked={prefs.credits.notifyLow} onChange={(v) => set('credits', { ...prefs.credits, notifyLow: v })} />
                <ToggleRow label="Set monthly credit limit" text="Pause tracking when the monthly limit is reached." checked={prefs.credits.monthlyLimit} onChange={(v) => set('credits', { ...prefs.credits, monthlyLimit: v })} />
              </div>
            </Section>
            </div>
          ) : (
            <EmptyRow
              icon={<Bell size={30} />}
              title="No credit preferences set"
              text="Configure usage limits and notifications to stay in control."
              action={
                <Button variant="outline" onClick={() => configure('credits')}>
                  Set Preferences
                </Button>
              }
            />
          )}
        </Group>
      </div>

      {anyEditing && (
        <div className={s.footer}>
          <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setPrefs(DEFAULTS)} disabled={!dirty}>
            Reset to Defaults
          </Button>
          {(saveMsg.error || saveMsg.ok || !canEdit) && (
            <span className={s.unsaved} role={saveMsg.error ? 'alert' : 'status'}>
              <Info size={14} /> {saveMsg.error ?? saveMsg.ok ?? 'Only workspace owners can change these preferences.'}
            </span>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setPrefs(saved);
              setEditing({});
            }}
          >
            Cancel
          </Button>
          <Button disabled={!dirty || !canEdit || saving || !workspaceId} onClick={save}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
    </>
  );
}
