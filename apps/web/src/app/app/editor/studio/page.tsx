import { randomUUID } from 'crypto';
import Link from 'next/link';
import { FilePlus2, FileText, History, Inbox, PenSquare } from 'lucide-react';
import { Badge, ButtonLink, DataTable, EmptyState, Notice, PageHeader, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Editor Studio · On-Page SEO Editor' };

type Draft = { article_key: string; title: string; revision: number; updated_at: string };
type Revision = { revision: number; title: string; created_at: string; characters: number; current: boolean };
type RevisionDetail = { revision: number; title: string; html: string; current_revision: number };
type Form = { id: string; name: string; version: number; active: boolean; fields: number; submissions: number; created_at: string; public_url: string };
type Submission = { id: string; at: string; values: Record<string, string | boolean> };

const plain = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|h[1-6]|li|div|figure|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const KEY = /^[a-zA-Z0-9_-]{3,100}$/;
const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none', background: 'var(--surface)' } as const;

/**
 * SEO Editor Studio (V13.3 editor): cloud drafts saved by the editor with
 * revision history and restore, plus hosted forms and their submissions.
 */
export default async function EditorStudioPage({ searchParams }: { searchParams: Promise<{ article?: string; rev?: string; form?: string; workspace?: string }> }) {
  const sp = await searchParams;
  const ctx = await getAppContext();
  const workspace = ctx.workspaces.find((w) => w.id === sp.workspace) ?? ctx.workspaces.find((w) => w.id === ctx.workspaceId) ?? ctx.workspaces[0];
  if (!workspace) {
    return (
      <>
        <PageHeader title="Editor Studio" />
        <EmptyState icon={<FileText size={30} />} title="No workspace yet" description="Create a workspace to use the SEO editor." action={<ButtonLink href="/app/getting-started">Get started</ButtonLink>} />
      </>
    );
  }
  const ws = workspace.id;
  const base = `/workspaces/${ws}`;
  const editorUrl = (article?: string) => `/app/seo-editor?workspace=${ws}${article ? `&article=${encodeURIComponent(article)}` : ''}`;
  const [drafts, forms] = await Promise.all([apiGet<Draft[]>(`${base}/articles`, { auth: true }), apiGet<Form[]>(`${base}/forms`, { auth: true })]);
  const article = sp.article && KEY.test(sp.article) ? sp.article : null;
  const revisions = article ? await apiGet<Revision[]>(`${base}/articles/${article}/revisions`, { auth: true }) : null;
  const revNo = sp.rev && /^\d{1,6}$/.test(sp.rev) ? Number(sp.rev) : null;
  const [selected, current] = article && revNo ? await Promise.all([apiGet<RevisionDetail>(`${base}/articles/${article}/revisions/${revNo}`, { auth: true }), apiGet<{ html: string; revision: number }>(`${base}/articles/${article}`, { auth: true })]) : [null, null];
  const formId = sp.form && /^[0-9a-f-]{36}$/.test(sp.form) ? sp.form : null;
  const submissions = formId ? await apiGet<Submission[]>(`${base}/forms/${formId}/submissions`, { auth: true }) : null;

  return (
    <>
      <PageHeader
        title="Editor Studio"
        description={`Cloud drafts, revision history and hosted forms of the SEO editor. Workspace: ${workspace.name}.`}
        actions={
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={editorUrl()} style={btn}>
              <PenSquare size={15} /> Open SEO Editor
            </a>
            <a href={editorUrl(randomUUID())} style={btn}>
              <FilePlus2 size={15} /> New article
            </a>
          </span>
        }
      />
      <div style={{ display: 'grid', gap: 16 }}>
        {ctx.workspaces.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
            Workspace:
            {ctx.workspaces.map((w) => (
              <Link key={w.id} href={`/app/editor/studio?workspace=${w.id}`} style={{ fontWeight: w.id === ws ? 700 : 400 }}>
                {w.name}
              </Link>
            ))}
          </div>
        )}

        <Panel title="Cloud drafts" description="The editor saves to the cloud automatically when you are signed in. Each save is a revision; conflicting saves are never overwritten." bodyless>
          {!drafts.ok ? (
            <div style={{ padding: 16 }}>
              <Notice tone="amber" title="Drafts could not be loaded.">
                {drafts.reason === 'forbidden' ? 'You need editor access in this workspace.' : 'Try again shortly.'}
              </Notice>
            </div>
          ) : (
            <DataTable
              columns={['Article', 'Revision', 'Updated', '']}
              rows={drafts.data.map((d) => [
                <span key="t" style={{ fontWeight: 600 }}>
                  {d.title}
                </span>,
                `r${d.revision}`,
                formatDateTime(d.updated_at),
                <span key="a" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <a href={editorUrl(d.article_key)} style={btn}>
                    Open
                  </a>
                  <Link href={`/app/editor/studio?workspace=${ws}&article=${d.article_key}`} style={btn}>
                    <History size={14} /> History
                  </Link>
                </span>,
              ])}
              empty={<EmptyState icon={<FileText size={30} />} title="No cloud drafts yet" description="Open the SEO editor and start writing; drafts sync here." />}
            />
          )}
        </Panel>

        {article && (
          <Panel title="Revision history" description="Restoring creates a new revision with the earlier content; history is never rewritten." actions={<Link href={`/app/editor/studio?workspace=${ws}`}>Close</Link>} bodyless>
            {!revisions?.ok ? (
              <div style={{ padding: 16 }}>
                <Notice tone="amber" title="Revisions could not be loaded.">Try again shortly.</Notice>
              </div>
            ) : (
              <DataTable
                columns={['Revision', 'Title', 'Saved', 'Size', '']}
                rows={revisions.data.map((r) => [
                  <span key="r">
                    r{r.revision} {r.current && <Badge tone="green">Current</Badge>}
                  </span>,
                  r.title,
                  formatDateTime(r.created_at),
                  `${r.characters.toLocaleString()} chars`,
                  <span key="a" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Link href={`/app/editor/studio?workspace=${ws}&article=${article}&rev=${r.revision}`} style={btn}>
                      Compare
                    </Link>
                    {!r.current && (
                      <ActionButton size="sm" variant="outline" path={`${base}/articles/${article}/revisions/${r.revision}/restore`} body={{}} confirm={`Restore revision ${r.revision} as a new revision?`} successMessage="Revision restored." revalidate={['/app/editor/studio']}>
                        Restore
                      </ActionButton>
                    )}
                  </span>,
                ])}
              />
            )}
          </Panel>
        )}

        {selected?.ok && current?.ok && (
          <Panel title={`Compare r${selected.data.revision} with the current draft (r${current.data.revision})`} description="Text only. Open the article in the editor to see formatting.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {[
                [`Revision ${selected.data.revision}`, selected.data.html],
                ['Current draft', current.data.html],
              ].map(([label, html]) => (
                <div key={label} style={{ minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{label}</h3>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, maxHeight: 480, overflow: 'auto', margin: 0 }}>{plain(html) || '(empty)'}</pre>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="Hosted forms" description="Forms are designed offline in the editor and become live only when activated. Editing an activated form creates a new version; earlier versions keep their submissions." bodyless>
          {!forms.ok ? (
            <div style={{ padding: 16 }}>
              <Notice tone="amber" title="Forms could not be loaded.">Try again shortly.</Notice>
            </div>
          ) : (
            <DataTable
              columns={['Form', 'Version', 'Status', 'Submissions', 'Activated', '']}
              rows={forms.data.map((f) => [
                <a key="n" href={f.public_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                  {f.name}
                </a>,
                `v${f.version}`,
                f.active ? <Badge tone="green">Live</Badge> : <Badge>Deactivated</Badge>,
                f.submissions,
                formatDateTime(f.created_at),
                <span key="a" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Link href={`/app/editor/studio?workspace=${ws}&form=${f.id}`} style={btn}>
                    <Inbox size={14} /> Submissions
                  </Link>
                  {f.active && (
                    <ActionButton size="sm" variant="outline" method="DELETE" path={`${base}/forms/${f.id}`} confirm="Deactivate this form? Embedded copies stop accepting submissions." successMessage="Form deactivated." revalidate={['/app/editor/studio']}>
                      Deactivate
                    </ActionButton>
                  )}
                </span>,
              ])}
              empty={<EmptyState icon={<Inbox size={30} />} title="No hosted forms" description="Insert a form in the editor and choose Activate to host it." />}
            />
          )}
        </Panel>

        {formId && (
          <Panel title="Submissions" description="Stored encrypted. Viewing is recorded in the audit log." actions={<Link href={`/app/editor/studio?workspace=${ws}`}>Close</Link>} bodyless>
            {!submissions?.ok ? (
              <div style={{ padding: 16 }}>
                <Notice tone="amber" title="Submissions could not be loaded.">
                  {submissions?.reason === 'forbidden' ? 'Reading submissions needs the workspace owner role.' : 'Try again shortly.'}
                </Notice>
              </div>
            ) : (
              <DataTable
                columns={['Received', 'Values']}
                rows={submissions.data.map((s) => [
                  formatDateTime(s.at),
                  <span key="v" style={{ overflowWrap: 'anywhere' }}>
                    {Object.entries(s.values)
                      .map(([k, v]) => `${k}: ${v === true ? 'yes' : v}`)
                      .join(' · ')}
                  </span>,
                ])}
                empty="No submissions yet."
              />
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
