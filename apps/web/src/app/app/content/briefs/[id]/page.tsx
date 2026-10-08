import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, PenLine, Sparkles } from 'lucide-react';
import { Badge, EmptyState, Field, Input, KeyValue, PageHeader, Panel, Select } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { appCrumbs } from '@/lib/nav';
import s from '@/components/app/content/content.module.css';

export const metadata = { title: 'Content Brief · Content Strategy' };

type BriefJson = {
  ideaId?: string | null;
  title?: string;
  metaDescription?: string;
  audience?: string;
  searchIntent?: string;
  wordCountTarget?: number;
  outline?: { heading: string; level: number; points: string[] }[];
  questions?: string[];
  secondaryKeywords?: string[];
  internalLinkIdeas?: string[];
  geoNotes?: string[];
  generatedBy?: string;
  generatedAt?: string;
};
type Brief = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  primaryKeyword: { normalizedTerm: string; countryCode: string; locale: string } | null;
  briefJson: BriefJson | null;
  planItems: { id: string; title: string; status: string }[];
};

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Editor starting document: the brief's headings and questions, no pre-written body copy. */
function starterHtml(b: Brief, j: BriefJson) {
  const parts = [`<h1>${esc(j.title || b.title)}</h1>`];
  for (const o of j.outline ?? []) {
    const level = Math.min(Math.max(o.level || 2, 2), 4);
    parts.push(`<h${level}>${esc(o.heading)}</h${level}>`, '<p></p>');
  }
  if (j.questions?.length) {
    parts.push('<h2>Frequently Asked Questions</h2>');
    for (const q of j.questions) parts.push(`<h3>${esc(q)}</h3>`, '<p></p>');
  }
  return parts.join('\n');
}

const STATUSES = ['DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED'];

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiGet<Brief>(`/user/content/briefs/${encodeURIComponent(id)}`, { auth: true });
  if (!res.ok) notFound();
  const b = res.data;
  const j = b.briefJson ?? {};
  const ai = await apiGet<{ aiAvailable: boolean }>(`/user/projects/${b.projectId}/content/summary`, { auth: true });
  const aiAvailable = ai.ok && ai.data.aiAvailable;
  const generated = !!j.generatedAt;
  const list = (title: string, items?: string[]) =>
    items?.length ? (
      <Panel title={title}>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Panel>
    ) : null;

  return (
    <>
      <PageHeader
        title={b.title}
        description="Content brief for the writer: what to cover, which questions to answer and how to make the page citable by AI search."
        crumbs={appCrumbs({ label: 'Content Strategy', href: '/app/content/ideas' }, { label: 'Drafts', href: '/app/content/briefs' }, { label: 'Brief' })}
        actions={
          <>
            <ActionButton variant="outline" icon={<Sparkles size={16} />} path={`/user/content/briefs/${b.id}/generate`} body={{}} disabled={!aiAvailable} title={aiAvailable ? 'Uses credits' : 'AI generation is not configured on this server yet.'}>
              {generated ? 'Regenerate with AI' : 'Draft with AI'}
            </ActionButton>
            <ActionButton
              icon={<PenLine size={16} />}
              path={`/user/projects/${b.projectId}/editor/documents`}
              body={{ title: b.title, content: { title: j.title || b.title, metaDescription: j.metaDescription ?? '', focusKeyword: b.primaryKeyword?.normalizedTerm, html: starterHtml(b, j) } }}
              redirectTo="/app/editor/{id}"
            >
              Write in Editor
            </ActionButton>
          </>
        }
      />
      <div className={s.stack}>
        <Panel title="Brief Details">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <KeyValue label="Status" value={humanize(b.status)} />
            <KeyValue label="Primary keyword" value={b.primaryKeyword ? `${b.primaryKeyword.normalizedTerm} (${b.primaryKeyword.locale}-${b.primaryKeyword.countryCode})` : '—'} />
            <KeyValue label="Search intent" value={j.searchIntent ?? '—'} />
            <KeyValue label="Target length" value={j.wordCountTarget ? `${j.wordCountTarget.toLocaleString('en-US')} words` : '—'} />
            <KeyValue label="Audience" value={j.audience ?? '—'} />
            <KeyValue label="Updated" value={formatDateTime(b.updatedAt)} />
            {generated && <KeyValue label="Drafted by" value={<Badge tone="blue">AI · {formatDateTime(j.generatedAt!)}</Badge>} />}
            {b.planItems.length > 0 && (
              <KeyValue
                label="In content plan"
                value={
                  <Link href="/app/content/plan" style={{ color: 'var(--blue)' }}>
                    {b.planItems.map((p) => p.title).join(', ')}
                  </Link>
                }
              />
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <ApiForm method="PATCH" path={`/user/content/briefs/${b.id}`} submitLabel="Update">
              <div className={s.formRow}>
                <Field label="Title" htmlFor="br-title">
                  <Input id="br-title" name="title" defaultValue={b.title} required minLength={3} maxLength={300} />
                </Field>
                <Field label="Status" htmlFor="br-status">
                  <Select id="br-status" name="status" defaultValue={b.status}>
                    {STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {humanize(x)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Meta description" htmlFor="br-meta">
                <Input id="br-meta" name="brief.metaDescription" defaultValue={j.metaDescription ?? ''} maxLength={500} />
              </Field>
            </ApiForm>
          </div>
        </Panel>

        {j.outline?.length ? (
          <Panel title="Outline">
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
              {j.outline.map((o, i) => (
                <li key={i} style={{ paddingLeft: (Math.max(o.level, 2) - 2) * 20 }}>
                  <b>
                    H{o.level} · {o.heading}
                  </b>
                  {o.points.length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--muted)', fontSize: 14 }}>
                      {o.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        ) : (
          <Panel title="Outline">
            <EmptyState
              compact
              icon={<FileText size={26} />}
              title="No outline yet"
              description={aiAvailable ? 'Draft the brief with AI to get an outline, questions, keywords and AI search notes.' : 'Outline the piece in the editor, or draft it with AI once AI generation is configured.'}
            />
          </Panel>
        )}
        {list('Questions to Answer', j.questions)}
        {list('Secondary Keywords', j.secondaryKeywords)}
        {list('Internal Link Ideas', j.internalLinkIdeas)}
        {list('AI Search (GEO) Notes', j.geoNotes)}
      </div>
    </>
  );
}
