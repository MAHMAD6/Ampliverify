import { Folder, Info } from 'lucide-react';
import { Field, Grid, IconCircle, Input, Notice, Panel, Select } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import type { WorkspaceView } from '@/lib/app-types';

export const metadata = { title: 'Project Defaults · Settings' };

/** Workspace-level defaults applied to projects without their own audit settings. */
export default async function ProjectDefaultsPage() {
  const { workspaceId } = await getAppContext();
  const ws = workspaceId ? await apiGet<WorkspaceView>(`/user/workspaces/${workspaceId}`, { auth: true }) : null;
  if (!ws?.ok) return <StateView kind="empty" icon={<Folder size={28} />} title="No workspace yet" description="Create a project to configure defaults." />;
  const d = ws.data.settings.projectDefaults ?? {};
  return (
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <IconCircle tone="blue" size={56}>
          <Folder size={26} />
        </IconCircle>
        <div>
          <h2 style={{ fontSize: 28 }}>Project Defaults</h2>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            Defaults for projects in this workspace. Each project can override them in its own Audit Settings. <strong style={{ color: 'var(--heading)' }}>Project-specific settings are not changed.</strong>
          </p>
        </div>
      </div>
      <ApiForm method="PATCH" path={`/user/workspaces/${ws.data.id}`} wrap="settings.projectDefaults" submitLabel="Save Defaults">
        <div style={{ display: 'grid', gap: 14 }}>
          <Panel title="Audit Settings" description="How audits run by default.">
            <Grid cols={2}>
              <Field label="Scope" htmlFor="d-scope">
                <Select id="d-scope" name="crawlScope" defaultValue={d.crawlScope ?? 'PAGE'}>
                  <option value="PAGE">Single page</option>
                  <option value="SITE">Whole site (crawl)</option>
                </Select>
              </Field>
              <Field label="Pages per site audit" htmlFor="d-max">
                <Input id="d-max" name="maxPages" type="number" min={1} max={200} data-type="number" defaultValue={d.maxPages ?? 25} />
              </Field>
              <Field label="Analyze for" htmlFor="d-mode">
                <Select id="d-mode" name="auditMode" defaultValue={d.auditMode ?? 'SEO'}>
                  <option value="SEO">Search (SEO)</option>
                  <option value="GEO">AI Search (GEO)</option>
                  <option value="BOTH">Both</option>
                </Select>
              </Field>
              <Field label="Automatic re-audit" htmlFor="d-freq">
                <Select id="d-freq" name="auditFrequency" defaultValue={d.auditFrequency ?? 'MANUAL'}>
                  <option value="MANUAL">Manual only</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </Select>
              </Field>
            </Grid>
          </Panel>
          <Panel title="Report Settings" description="Suggested reporting cadence for new projects.">
            <Field label="Report frequency" htmlFor="d-report">
              <Select id="d-report" name="reportFrequency" defaultValue={d.reportFrequency ?? 'NONE'}>
                <option value="NONE">No scheduled reports</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </Select>
            </Field>
          </Panel>
          <Notice icon={<Info size={20} />} title="GEO monitoring defaults">
            Default AI platforms, brand names and competitors are set in Settings → AI &amp; GEO Preferences.
          </Notice>
        </div>
      </ApiForm>
    </>
  );
}
