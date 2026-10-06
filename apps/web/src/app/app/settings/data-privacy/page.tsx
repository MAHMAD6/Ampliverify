import { ChevronDown } from 'lucide-react';
import { Button, Field, Grid, Input, Notice, Panel, SettingRow, Stack } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';

export const metadata = { title: 'Data & Privacy · Settings' };

/**
 * Export requests, retention, public report access and privacy preferences
 * need storage the database guide does not define yet (docs/INPUTS.md), so
 * every control here is read-only.
 */
export default function DataPrivacyPage() {
  return (
    <>
      <h2>Data &amp; Privacy</h2>
      <p>Control your data, privacy preferences, shared-report access, and account data management.</p>
      <Stack>
        <Panel title="Data Export" description="Request a copy of your account data, including projects, reports, preferences, and integrations." actions={<Button variant="outline" disabled>Export My Data</Button>}>
          <Notice>You’ll be notified when your export is ready to download.</Notice>
        </Panel>
        <Panel title="Data Retention" description="Choose how long eligible project data, reports, saved prompts, and activity history are retained.">
          <Grid cols={2}>
            <Field label="Project Data Retention" htmlFor="dp-retention">
              <Input id="dp-retention" value="—" readOnly disabled />
            </Field>
            <Notice tone="neutral">Some records may be retained when required for legal, security, billing, or compliance purposes.</Notice>
          </Grid>
        </Panel>
        <Panel title="Shared Report Access" description="Manage whether shared report links can be accessed outside your account.">
          <SettingRow title="Allow public access to shared reports" description="When enabled, anyone with an active share link may view the specific shared report." control={<Toggle label="Allow public access to shared reports" disabled />} />
        </Panel>
        <Panel title="Privacy Preferences">
          <SettingRow title="Product usage data" description="Control optional product-improvement data where applicable." control={<Toggle label="Product usage data" disabled />} />
          <SettingRow title="Product communications" description="Control optional email communications about product updates and features." control={<Toggle label="Product communications" disabled />} />
        </Panel>
        <details>
          <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
            <Panel title="Advanced" description="Additional data controls and sensitive account-management options." actions={<ChevronDown size={20} />} />
          </summary>
          <div style={{ marginTop: 12 }}>
            <Panel>
              <SettingRow title="Delete account" description="Permanently delete your account after a recovery period. Billing, security and audit records are kept as required by law." control={<Button variant="secondary" disabled>Request Deletion</Button>} />
            </Panel>
          </div>
        </details>
      </Stack>
    </>
  );
}
