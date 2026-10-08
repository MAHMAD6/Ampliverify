import Link from 'next/link';
import { FilePlus2, Folder, Globe, SquarePen } from 'lucide-react';
import { ButtonLink, DataTable, EmptyState, Field, Input, PageHeader, Panel } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'On-Page SEO Editor' };

type DocRow = { id: string; title: string; status: string; pageUrl: string | null; updatedAt: string; createdBy: string; version: number };

/** Editor documents for the selected project: start a new page, import an existing one, or continue a draft. */
export default async function EditorIndexPage() {
  const { selectedProject: project } = await getAppContext();
  const res = project ? await apiGet<DocRow[]>(`/user/projects/${project.id}/editor/documents`, { auth: true }) : null;
  const docs = res?.ok ? res.data : [];
  return (
    <>
      <PageHeader
        title="On-Page SEO Editor"
        description={`Create, optimize, and publish content that ranks and converts.${project ? ` Project: ${project.name}.` : ''}`}
      />
      {!project ? (
        <EmptyState icon={<Folder size={30} />} title="Select a project" description="Editor documents are saved per project." action={<ButtonLink href="/app/projects">Select a Project</ButtonLink>} />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <Panel title="Write a New Page" description="Start from an outline and get live SEO and AI search scoring as you write.">
              <ApiForm path={`/user/projects/${project.id}/editor/documents`} submitLabel="Start Writing" redirectTo="/app/editor/{id}">
                <Field label="Working title" htmlFor="ed-title">
                  <Input id="ed-title" name="title" required maxLength={300} placeholder="e.g. The complete guide to technical SEO" icon={<SquarePen size={16} />} />
                </Field>
              </ApiForm>
            </Panel>
            <Panel title="Optimize an Existing Page" description="Import the title, description and main content of a live page from your site.">
              <ApiForm path={`/user/projects/${project.id}/editor/import`} submitLabel="Import Page" redirectTo="/app/editor/{id}">
                <Field label="Page URL" htmlFor="ed-url">
                  <Input id="ed-url" name="url" type="url" required placeholder={`https://${project.primaryDomain ?? 'example.com'}/blog/post`} icon={<Globe size={16} />} />
                </Field>
              </ApiForm>
            </Panel>
          </div>
          <Panel title={`Documents (${docs.length})`} bodyless>
            <DataTable
              columns={['Document', 'Page', 'Status', 'Version', 'Updated', 'Author', 'Actions']}
              rows={docs.map((d) => [
                <Link key="t" href={`/app/editor/${d.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                  {d.title}
                </Link>,
                d.pageUrl ? (
                  <a key="u" href={d.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {d.pageUrl}
                  </a>
                ) : (
                  'New page'
                ),
                humanize(d.status),
                d.version ? `v${d.version}` : '—',
                formatDateTime(d.updatedAt),
                d.createdBy,
                <span key="a" style={{ display: 'flex', gap: 6 }}>
                  <ButtonLink size="sm" variant="outline" href={`/app/editor/${d.id}`}>
                    Open
                  </ButtonLink>
                  <ActionButton size="sm" variant="ghost" method="PATCH" path={`/user/editor/documents/${d.id}`} body={{ status: 'ARCHIVED' }} confirm={`Archive “${d.title}”?`}>
                    Archive
                  </ActionButton>
                </span>,
              ])}
              empty={<EmptyState icon={<FilePlus2 size={30} />} title="No documents yet" description="Write a new page or import one from your site to get started." />}
            />
          </Panel>
        </div>
      )}
    </>
  );
}
