import { ArrowUpRight } from 'lucide-react';
import { Badge, Button, EmptyState, KeyValue, Notice, Panel, SettingRow, Stack } from '@/components/ui';
import { apiList } from '@/lib/api';
import type { IntegrationProvider } from '@/lib/types';

export const metadata = { title: 'Integrations · Settings' };

/** Only providers active in the registry are shown, never hard-coded ones. */
export default async function IntegrationsSettingsPage() {
  const providers = await apiList<IntegrationProvider>('/public/integrations');
  return (
    <>
      <h2>Integrations</h2>
      <p>Connect supported services to extend AmpliVerify. Only available integrations are shown as connectable.</p>
      <Stack>
        <Panel title="Connected Integrations" description="Manage services that are currently connected to this workspace.">
          <EmptyState compact icon={<ArrowUpRight size={24} />} title="No integrations connected" description="Connected services will appear here after you authorize them." />
        </Panel>
        <Panel title="Available Integrations" description="Integrations become available here as they are supported in production.">
          {providers.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>No integrations are available to connect yet.</p>
          ) : (
            providers.map((p) => (
              <SettingRow
                key={p.key}
                title={p.name}
                description="Authorize access to use this integration in your projects."
                control={
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Badge tone="blue">Available</Badge>
                    <Button variant="outline" disabled title="Connecting requires sign-in">
                      Connect
                    </Button>
                  </div>
                }
              />
            ))
          )}
        </Panel>
        <Panel title="Integration Access" description="Connections use explicit authorization and only access data required for the selected functionality.">
          <KeyValue label="Connection status" value="—" />
          <KeyValue label="Authorized services" value="—" />
          <KeyValue label="Last sync" value="—" />
        </Panel>
        <Notice tone="neutral">You can disconnect an integration at any time. Disconnecting stops future syncs; previously imported data follows your retention settings.</Notice>
      </Stack>
    </>
  );
}
