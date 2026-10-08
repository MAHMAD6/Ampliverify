import { Download } from 'lucide-react';
import { Badge, Field, Grid, Notice, Panel, Select, SettingRow, Stack } from '@/components/ui';
import { ActionButton, ApiForm, AutoRefresh } from '@/components/ui/actions';
import { getAppContext } from '@/lib/project';
import { apiGet } from '@/lib/api';
import type { WorkspaceView } from '@/lib/app-types';
import { formatDateTime, humanize } from '@/lib/format';

export const metadata = { title: 'Data & Privacy · Settings' };

type ExportRow = { id: string; status: string; sizeBytes: string | null; createdAt: string; completedAt: string | null; expiresAt: string | null; error: string | null };

/** Data export, retention, shared-report policy and personal privacy preferences. */
export default async function DataPrivacyPage() {
  const { workspaceId } = await getAppContext();
  const [wsRes, exportsRes, privacyRes] = await Promise.all([
    workspaceId ? apiGet<WorkspaceView>(`/user/workspaces/${workspaceId}`, { auth: true }) : null,
    workspaceId ? apiGet<ExportRow[]>(`/user/workspaces/${workspaceId}/exports`, { auth: true }) : null,
    apiGet<{ productAnalytics: boolean; productEmails: boolean }>('/user/me/privacy', { auth: true }),
  ]);
  const ws = wsRes?.ok ? wsRes.data : null;
  const exportsList = exportsRes?.ok ? exportsRes.data : [];
  const privacy = privacyRes.ok ? privacyRes.data : { productAnalytics: true, productEmails: true };
  const pending = exportsList.some((e) => e.status === 'QUEUED' || e.status === 'RUNNING');
  const policy = ws?.settings.privacy ?? {};
  return (
    <>
      <AutoRefresh active={pending} seconds={4} />
      <h2>Data &amp; Privacy</h2>
      <p>Control your data, privacy preferences, shared-report access, and account data management.</p>
      <Stack>
        <Panel
          title="Data Export"
          description="Download a copy of your workspace data: projects, audits, tasks, keywords, AI search results, content and credits."
          actions={
            workspaceId && ws?.permissions.update ? (
              <ActionButton variant="outline" path={`/user/workspaces/${workspaceId}/exports`} disabled={pending}>
                {pending ? 'Preparing export…' : 'Export My Data'}
              </ActionButton>
            ) : undefined
          }
        >
          {exportsList.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {exportsList.map((e) => (
                <li key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, alignItems: 'center' }}>
                  <span>
                    Requested {formatDateTime(e.createdAt)} <Badge tone={e.status === 'SUCCEEDED' ? 'green' : e.status === 'FAILED' ? 'amber' : 'blue'}>{humanize(e.status)}</Badge>
                  </span>
                  {e.status === 'SUCCEEDED' && e.expiresAt && new Date(e.expiresAt) > new Date() ? (
                    <a href={`/api/files/user/exports/${e.id}/download`} style={{ display: 'inline-flex', gap: 6, color: 'var(--blue)' }}>
                      <Download size={16} /> Download JSON
                    </a>
                  ) : e.status === 'SUCCEEDED' ? (
                    <small style={{ color: 'var(--muted)' }}>Expired</small>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Notice>You’ll be notified when your export is ready to download. Exports are available for 7 days.</Notice>
          )}
        </Panel>

        {workspaceId && ws?.permissions.update && (
          <Panel title="Data Retention & Sharing" description="Workspace policies for history and shared report links.">
            <ApiForm method="PATCH" path={`/user/workspaces/${workspaceId}`} transform={(v) => ({ settings: { privacy: v } })}>
              <Grid cols={2}>
                <Field label="Project data retention" htmlFor="dp-retention">
                  <Select id="dp-retention" name="retentionDays" data-type="number" defaultValue={policy.retentionDays ? String(policy.retentionDays) : ''}>
                    <option value="">Keep until deleted</option>
                    <option value="90">90 days</option>
                    <option value="180">6 months</option>
                    <option value="365">1 year</option>
                    <option value="730">2 years</option>
                  </Select>
                </Field>
                <Field label="Share links expire after" htmlFor="dp-expiry">
                  <Select id="dp-expiry" name="shareLinkExpiryDays" data-type="number" defaultValue={String(policy.shareLinkExpiryDays ?? 30)}>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </Select>
                </Field>
              </Grid>
              <SettingRow
                title="Allow public access to shared reports"
                description="When enabled, anyone with an active share link may view that report."
                control={<input type="checkbox" name="allowPublicReportShares" defaultChecked={policy.allowPublicReportShares !== false} aria-label="Allow public access to shared reports" />}
              />
              <Notice tone="neutral">Some records are retained when required for legal, security, billing, or compliance purposes.</Notice>
            </ApiForm>
          </Panel>
        )}

        <Panel title="Privacy Preferences" description="Personal choices that apply to your account.">
          <ApiForm method="PUT" path="/user/me/privacy">
            <SettingRow title="Product usage data" description="Allow anonymous product-improvement analytics." control={<input type="checkbox" name="productAnalytics" defaultChecked={privacy.productAnalytics} aria-label="Product usage data" />} />
            <SettingRow title="Product communications" description="Receive occasional emails about product updates and features." control={<input type="checkbox" name="productEmails" defaultChecked={privacy.productEmails} aria-label="Product communications" />} />
          </ApiForm>
        </Panel>

        <Panel title="Delete account" description="To permanently delete your account and data, contact support. Billing, security and audit records are kept as required by law.">
          <a href="/app/help" style={{ color: 'var(--blue)' }}>
            Contact support →
          </a>
        </Panel>
      </Stack>
    </>
  );
}
