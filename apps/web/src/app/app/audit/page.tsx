import { FileSearch, Folder, Globe, Info, Search } from 'lucide-react';
import { Button, ButtonLink, DataTable, Input, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'On-Page SEO Audit' };

/**
 * On-Page SEO Audit (states from user-app-batch2a/03). Audits are metered and
 * run by the audit API (`audit_runs`, `audit_pages`, `audit_findings`), which is
 * not built yet: the start form is shown pre-filled from the selected project
 * but stays disabled, and the history table is empty. Results will live at
 * /app/audit/[id] per the navigation page map.
 */
export default async function AuditPage() {
  const { selectedProject } = await getAppContext();
  const domain = selectedProject?.primaryDomain ?? '';

  return (
    <>
      <PageHeader title="On-Page SEO Audit" description="Run audits, review results, and manage audit activity." />

      <Panel>
        {selectedProject ? (
          <StateView
            kind="empty"
            icon={<FileSearch size={40} />}
            title="Run your first SEO audit"
            description={`Enter your website URL to get started. The audit runs against ${selectedProject.name}.`}
            action={
              <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: 'min(560px, 100%)' }}>
                <div style={{ flex: '1 1 260px' }}>
                  <Input name="url" type="url" defaultValue={domain ? `https://${domain}` : ''} placeholder="https://example.com" aria-label="Website URL" icon={<Globe size={16} />} disabled />
                </div>
                <Button type="submit" disabled icon={<Search size={16} />}>
                  Start Audit
                </Button>
              </form>
            }
            secondary={
              <span style={{ width: '100%', fontSize: 13, color: 'var(--muted)', display: 'inline-flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                <Info size={14} /> Audits are not available for your account yet.
              </span>
            }
          />
        ) : (
          <StateView
            kind="empty"
            icon={<Folder size={40} />}
            title="Select a project to audit"
            description="Audits run against a project’s website. Choose a project, then start your first audit."
            action={<ButtonLink href="/app/projects">Select a Project</ButtonLink>}
          />
        )}
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel title="Audit History" description="Every audit run for the selected project, newest first." bodyless>
          <DataTable
            columns={['Audit', 'Pages', 'Score', 'Critical', 'Issues', 'Passed', 'Started', 'Status']}
            empty={<p style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No audits yet.</p>}
          />
        </Panel>
      </div>
    </>
  );
}
