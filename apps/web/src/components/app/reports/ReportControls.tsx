'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Copy, FileText, Share2 } from 'lucide-react';
import { apiAction } from '@/lib/actions';
import { Button, Field, Input, Select } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import { REPORT_TYPES } from './meta';

const SECTIONS = [
  ['overview', 'Overview'],
  ['audit', 'SEO audit'],
  ['recommendations', 'Top recommendations'],
  ['tasks', 'Optimization tasks'],
  ['geo', 'AI search visibility'],
  ['geo_citations', 'Sources cited by AI'],
  ['keywords', 'Tracked keywords'],
  ['content', 'Content plan'],
] as const;

/** Generate a report for a project, then open it. */
export function GenerateReportForm({ projects, defaultProjectId }: { projects: { id: string; name: string }[]; defaultProjectId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('EXECUTIVE_SUMMARY');
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const projectId = String(f.get('projectId'));
        const sections = f.getAll('sections').map(String);
        setError(null);
        start(async () => {
          const r = await apiAction<{ id: string }>('POST', `/user/projects/${projectId}/reports`, {
            type,
            title: String(f.get('title') ?? '').trim() || undefined,
            periodStart: new Date(String(f.get('from'))).toISOString(),
            periodEnd: new Date(String(f.get('to'))).toISOString(),
            ...(type === 'CUSTOM' ? { sections } : {}),
          });
          if (!r.ok) return setError(r.message);
          router.push(`/app/reports/${r.data.id}`);
        });
      }}
      style={{ display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Field label="Project" htmlFor="g-project">
          <Select id="g-project" name="projectId" defaultValue={defaultProjectId ?? projects[0]?.id}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Report type" htmlFor="g-type">
          <Select id="g-type" value={type} onChange={(e) => setType(e.target.value)}>
            {REPORT_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From" htmlFor="g-from">
          <Input id="g-from" name="from" type="date" defaultValue={monthAgo} max={today} required />
        </Field>
        <Field label="To" htmlFor="g-to">
          <Input id="g-to" name="to" type="date" defaultValue={today} max={today} required />
        </Field>
      </div>
      <Field label="Title (optional)" htmlFor="g-title">
        <Input id="g-title" name="title" maxLength={200} placeholder="e.g. Monthly SEO report — October" />
      </Field>
      {type === 'CUSTOM' && (
        <fieldset style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
          <legend>Sections</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {SECTIONS.map(([k, l]) => (
              <label key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" name="sections" value={k} defaultChecked={k === 'overview'} /> {l}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button type="submit" icon={<FileText size={18} />} disabled={pending || !projects.length}>
          {pending ? 'Generating…' : 'Generate Report'}
        </Button>
        <ActionMessage error={error} />
      </div>
    </form>
  );
}

/** Creates a read-only share link and shows it once (only its hash is stored). */
export function ShareReportButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <Button
        variant="outline"
        icon={<Share2 size={16} />}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await apiAction<{ url: string }>('POST', `/user/reports/${reportId}/shares`, {});
            if (!r.ok) return setError(r.message);
            setUrl(r.data.url);
            router.refresh();
          })
        }
      >
        {pending ? 'Creating link…' : 'Create share link'}
      </Button>
      {url && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
          <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(url)}>
            Copy
          </Button>
        </div>
      )}
      {url && <small style={{ color: 'var(--muted)' }}>Copy this link now — it is shown only once. Anyone with the link can view the report until it expires or is revoked.</small>}
      <ActionMessage error={error} />
    </div>
  );
}
