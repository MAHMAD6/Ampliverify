'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
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
import { Button, Select } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import s from './ai-geo.module.css';

type Platform = { key: string; name: string };
type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

type Prefs = {
  platforms: string[];
  location: string;
  language: string;
  frequency: Frequency;
  citations: { track: boolean; authority: boolean; snippets: boolean };
  competitors: { enabled: boolean; citations: boolean; compare: boolean };
  depth: 'LIGHT' | 'STANDARD' | 'DEEP';
  focus: string[];
  credits: { notifyLow: boolean; monthlyLimit: boolean };
};

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
};

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
 * AI & GEO Preferences (chat design 2026-10-06). Tracking platforms come from
 * the GEO platform registry (`GET /public/geo-platforms`); locations and
 * languages from the shared lists. The form is fully interactive, but there
 * is no preferences API yet, so Save stays disabled and nothing is persisted.
 */
export function AiGeoPreferences({ platforms, locations, languages }: { platforms: Platform[]; locations: string[]; languages: string[] }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
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
  const dirty = JSON.stringify(prefs) !== JSON.stringify(DEFAULTS);
  const selected = platforms.filter((p) => prefs.platforms.includes(p.key));

  return (
    <>
      <div className={s.titleRow}>
        <div>
          <h2>
            AI &amp; GEO Preferences <Info size={18} className={s.info} aria-hidden />
          </h2>
          <p>Configure how AI search tracking and analysis work for your projects. These settings apply to new projects by default and can be customized per project.</p>
        </div>
        <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setPrefs(DEFAULTS)} disabled={!dirty}>
          Restore Defaults
        </Button>
      </div>

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

        <Section icon={<Coins size={22} />} title="Credit Usage Controls" text="Set limits and notifications for credit usage.">
          <div className={s.two}>
            <ToggleRow label="Notify when credits are low" text="Get notified when your credit balance is running low." checked={prefs.credits.notifyLow} onChange={(v) => set('credits', { ...prefs.credits, notifyLow: v })} />
            <ToggleRow label="Set monthly credit limit" text="Pause tracking when the monthly limit is reached." checked={prefs.credits.monthlyLimit} onChange={(v) => set('credits', { ...prefs.credits, monthlyLimit: v })} />
          </div>
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

      <div className={s.footer}>
        <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setPrefs(DEFAULTS)} disabled={!dirty}>
          Reset to Defaults
        </Button>
        <span className={s.unsaved}>
          <Info size={14} /> Preferences can’t be saved yet; changes here are not stored.
        </span>
        <Button variant="secondary" onClick={() => setPrefs(DEFAULTS)} disabled={!dirty}>
          Cancel
        </Button>
        <Button disabled>Save Changes</Button>
      </div>
    </>
  );
}
