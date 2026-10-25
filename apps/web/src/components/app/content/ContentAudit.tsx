import { ClipboardCheck, Sparkles } from 'lucide-react';
import { Badge, DataTable, EmptyState, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { getQuote, quoteText } from '@/lib/credits';
import { formatDateTime } from '@/lib/format';
import { getAppContext } from '@/lib/project';
import s from './content.module.css';

type Summary = { pages: number; totalWords: number; avgWords: number; thin: number; duplicateTitles: number; missingDescriptions: number; headingIssues: number; withQuestions: number; withSchema: number; auditedAt: string | null };
type Row = { url: string; title: string | null; words: number; h1: number; headings: number; questionHeadings: number; internalLinks: number; schema: string[]; issues: string[] };
type AiPage = { url: string; quality: 'STRONG' | 'ADEQUATE' | 'WEAK'; summary: string; recommendations: string[] };
type Audit = { id: string; createdAt: string; summary: Summary; pages: Row[]; ai: { generatedAt: string; pages: AiPage[] } | null };
type ListItem = { id: string; createdAt: string };

const QUALITY_TONE: Record<AiPage['quality'], 'green' | 'blue' | 'amber'> = { STRONG: 'green', ADEQUATE: 'blue', WEAK: 'amber' };

/** Content Audit: inventory and structure checks from the latest site audit, with optional AI quality assessment. */
export async function ContentAudit({ projectId, aiAvailable }: { projectId: string; aiAvailable: boolean }) {
  const list = await apiGet<ListItem[]>(`/user/projects/${projectId}/content/audits`, { auth: true });
  const latestId = list.ok ? list.data[0]?.id : undefined;
  const [audit, quote] = await Promise.all([
    latestId ? apiGet<Audit>(`/user/content/audits/${latestId}`, { auth: true }) : Promise.resolve(null),
    aiAvailable ? getAppContext().then((c) => getQuote(c.workspaceId, 'ai.content_audit')) : Promise.resolve(null),
  ]);
  const a = audit?.ok ? audit.data : null;
  const runButton = (
    <ActionButton path={`/user/projects/${projectId}/content/audits`} body={{}} icon={<ClipboardCheck size={16} />} revalidate={['/app/content/audit']} variant={a ? 'outline' : 'primary'}>
      {a ? 'Re-run Content Audit' : 'Run Content Audit'}
    </ActionButton>
  );
  if (!a) {
    return (
      <Panel title="Content Audit" description="Checks every crawled page for thin content, duplicate titles and descriptions, and heading structure.">
        <EmptyState icon={<ClipboardCheck size={30} />} title="No content audit yet" description="It uses the pages from your latest site audit, so run a site audit first." action={runButton} />
      </Panel>
    );
  }
  const ai = new Map((a.ai?.pages ?? []).map((p) => [p.url, p]));
  const m = a.summary;
  return (
    <>
      <Panel
        title="Content Audit"
        description={`From the site audit of ${m.auditedAt ? formatDateTime(m.auditedAt) : '—'} · analyzed ${formatDateTime(a.createdAt)}`}
        actions={
          <span className={s.actions}>
            {runButton}
            {aiAvailable && (
              <ActionButton path={`/user/content/audits/${a.id}/assess`} body={{}} icon={<Sparkles size={16} />} variant="outline" revalidate={['/app/content/audit']} title={(quote && quoteText(quote)) || undefined}>
                {a.ai ? 'Re-assess with AI' : 'Assess quality with AI'}
              </ActionButton>
            )}
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            ['Pages', m.pages],
            ['Avg. words', m.avgWords],
            ['Thin pages', m.thin],
            ['Duplicate titles', m.duplicateTitles],
            ['Missing descriptions', m.missingDescriptions],
            ['Heading issues', m.headingIssues],
            ['With question headings', m.withQuestions],
            ['With structured data', m.withSchema],
          ].map(([label, value]) => (
            <div key={label as string} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
              <b style={{ fontSize: 20 }}>{Number(value).toLocaleString('en-US')}</b>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title={`Pages (${a.pages.length})`} description={a.ai ? `AI quality assessment from ${formatDateTime(a.ai.generatedAt)} — recommendations, not measurements.` : undefined} bodyless>
        <DataTable
          columns={['Page', 'Words', 'Headings', 'Issues', ...(a.ai ? ['AI assessment'] : [])]}
          rows={a.pages.slice(0, 200).map((p) => {
            const x = ai.get(p.url);
            return [
              <span key="u" style={{ display: 'grid', gap: 2, maxWidth: 360 }}>
                <b style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title ?? '(no title)'}</b>
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontSize: 12, wordBreak: 'break-all' }}>
                  {p.url}
                </a>
              </span>,
              p.words.toLocaleString('en-US'),
              `${p.headings} (${p.questionHeadings} questions)`,
              p.issues.length ? (
                <ul key="i" style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                  {p.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : (
                <Badge key="ok" tone="green">
                  No issues
                </Badge>
              ),
              ...(a.ai
                ? [
                    x ? (
                      <span key="ai" style={{ display: 'grid', gap: 4, fontSize: 13, maxWidth: 360 }}>
                        <Badge tone={QUALITY_TONE[x.quality]}>{x.quality.toLowerCase()}</Badge>
                        <span>{x.summary}</span>
                        {x.recommendations.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {x.recommendations.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </span>
                    ) : (
                      '—'
                    ),
                  ]
                : []),
            ];
          })}
        />
      </Panel>
    </>
  );
}
