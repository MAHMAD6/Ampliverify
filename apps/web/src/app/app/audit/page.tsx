import { Folder } from 'lucide-react';
import { ButtonLink, DataTable, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { AuditSetup, ProjectContext } from '@/components/app/ModuleSetup';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'On-Page SEO Audit' };

/**
 * On-Page SEO Audit (states: user-app-batch2a/03; setup panel: Add Project
 * design). Audits are metered and run by the audit API (`audit_runs`,
 * `audit_pages`, `audit_findings`), which is not built yet: the page-URL form
 * is shown for the selected project but stays disabled, and the history table
 * is empty. Results will live at /app/audit/[id] per the navigation page map.
 */
export default async function AuditPage() {
  const { selectedProject } = await getAppContext();

  return (
    <>
      {selectedProject && <ProjectContext project={selectedProject} />}
      <PageHeader title="On-Page SEO Audit" description="Analyze a specific page to identify SEO issues and opportunities." />

      {selectedProject ? (
        <AuditSetup project={selectedProject} />
      ) : (
        <div style={{ marginBottom: 16 }}>
          <Panel>
          <StateView
            kind="empty"
            icon={<Folder size={40} />}
            title="Select a project to audit"
            description="Audits run against a project’s website. Choose a project, then start your first audit."
            action={<ButtonLink href="/app/projects">Select a Project</ButtonLink>}
          />
          </Panel>
        </div>
      )}

      <Panel title="Audit History" description="Every audit run for the selected project, newest first." bodyless>
        <DataTable
          columns={['Audit', 'Page', 'Score', 'Critical', 'Issues', 'Passed', 'Started', 'Status']}
          empty={<p style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No audits yet.</p>}
        />
      </Panel>
    </>
  );
}
