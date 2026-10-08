import { Bell, Mail, Users } from 'lucide-react';
import { Field, Notice, SettingRow, Textarea } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { ApiForm } from '@/components/ui/actions';
import { FactRows, loadSettings, SettingsGrid, SettingsSection, SettingsShell } from '@/components/admin/AdminSettings';

export const metadata = { title: 'Notifications · Settings' };

type Notifications = { staffEmails?: string[]; alerts?: Record<string, boolean> };

const ALERTS = [
  ['contact', 'Contact form messages', 'A visitor sent a message from the website.'],
  ['support', 'Support requests', 'A customer opened a support request.'],
  ['application', 'Job applications', 'Someone applied for an open role.'],
  ['payment_failed', 'Payment failures', 'Stripe could not collect a subscription payment.'],
  ['incident', 'Incidents', 'An administrator opened a system incident.'],
] as const;

/** Staff alert recipients and events (`platform.notifications`). Customer notifications are per user (Settings → Notifications in the app). */
export default async function NotificationSettingsPage() {
  const settings = await loadSettings();
  const n = settings?.value<Notifications>('platform.notifications', {}) ?? {};
  return (
    <SettingsShell
      tab="notifications"
      about={{ title: 'About Notifications', text: 'Staff alerts are emailed to the recipients below. Customers choose their own in-app and email notifications in their account settings.' }}
      footer="Staff alerts are sent only when an email provider is configured (RESEND_API_KEY)."
    >
      {!settings ? (
        <Notice tone="neutral">Settings could not be loaded with your permissions.</Notice>
      ) : (
        <ApiForm method="PUT" path="/admin/settings/platform.notifications" wrap="value" submitLabel="Save Notification Settings" successMessage="Settings saved.">
          <SettingsGrid>
            <SettingsSection icon={<Users size={24} />} tone="blue" title="Recipients" description="Who receives staff alerts, in addition to the support email in General.">
              <Field label="Staff email addresses" htmlFor="n-to" hint="One per line or comma separated.">
                <Textarea id="n-to" name="staffEmails" data-type="list" rows={4} defaultValue={(n.staffEmails ?? []).join('\n')} placeholder="ops@yourcompany.com" />
              </Field>
            </SettingsSection>
            <SettingsSection icon={<Bell size={24} />} tone="amber" title="Staff Alerts" description="Events that email the recipients.">
              {ALERTS.map(([key, title, text]) => (
                <SettingRow key={key} title={title} description={text} control={<Toggle label={title} name={`alerts.${key}`} defaultChecked={n.alerts?.[key] !== false} />} />
              ))}
            </SettingsSection>
            <SettingsSection icon={<Mail size={24} />} tone="green" title="Customer Notifications" description="Sent to customers based on their own preferences." wide>
              <FactRows
                rows={[
                  ['Audit completed / failed', 'In-app; email optional per user'],
                  ['Fix verified, report ready, AI search check completed', 'In-app; email optional per user'],
                  ['Low credits, payment failed, invoice paid', 'Workspace owners; email on by default'],
                  ['Workspace invitations, password reset, email verification', 'Always emailed (transactional)'],
                ]}
              />
            </SettingsSection>
          </SettingsGrid>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>{settings.updated('platform.notifications')}</p>
        </ApiForm>
      )}
    </SettingsShell>
  );
}
