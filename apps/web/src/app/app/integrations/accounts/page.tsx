import { PageHeader } from '@/components/ui';
import { appCrumbs } from '@/lib/nav';
import SettingsIntegrations from '@/app/app/settings/integrations/page';
import p from '@/components/app/pages.module.css';

export const metadata = { title: 'Connected Accounts · Integrations' };

/** The connection catalogue (shared with Settings → Integrations). */
export default function ConnectedAccountsPage(props: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  return (
    <>
      <PageHeader title="Connected Accounts" description="Connect and manage the services AmpliVerify reads data from or publishes to." crumbs={appCrumbs({ label: 'Integrations', href: '/app/integrations' }, { label: 'Connected Accounts' })} />
      <div className={p.settingsContent}>
        <SettingsIntegrations {...props} />
      </div>
    </>
  );
}
