import { Lock, Shield, Users } from 'lucide-react';
import { Field, Input, Notice, SettingRow } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { ApiForm } from '@/components/ui/actions';
import { FactRows, loadSettings, SettingsGrid, SettingsSection, SettingsShell } from '@/components/admin/AdminSettings';

export const metadata = { title: 'Security · Settings' };

type Security = { requireAdminMfa?: boolean; allowPasskeys?: boolean; invitationExpiryDays?: number };

/** Platform security policies (`platform.security`). */
export default async function SecuritySettingsPage() {
  const settings = await loadSettings();
  const sec = settings?.value<Security>('platform.security', {}) ?? {};
  return (
    <SettingsShell
      tab="security"
      about={{ title: 'About Security Settings', text: 'Platform-wide security rules. Changes apply to the next request; administrators without two-factor authentication are locked out of this console when MFA is required.' }}
    >
      {!settings ? (
        <Notice tone="neutral">Settings could not be loaded with your permissions.</Notice>
      ) : (
        <ApiForm method="PUT" path="/admin/settings/platform.security" wrap="value" submitLabel="Save Security Settings" successMessage="Settings saved.">
          <SettingsGrid>
            <SettingsSection icon={<Users size={24} />} tone="purple" title="Admin Security" description="Rules for platform administrators.">
              <SettingRow
                title="Require MFA for the admin console"
                description="Admin API requests are refused unless the administrator has two-factor authentication on. Turn it on for your own account first (Account → Security)."
                control={<Toggle label="Require MFA for the admin console" name="requireAdminMfa" defaultChecked={sec.requireAdminMfa === true} />}
              />
            </SettingsSection>
            <SettingsSection icon={<Shield size={24} />} tone="blue" title="Authentication" description="Sign-in methods offered to users.">
              <SettingRow title="Allow passkeys" description="Show passkey sign-in and let users register passkeys." control={<Toggle label="Allow passkeys" name="allowPasskeys" defaultChecked={sec.allowPasskeys !== false} />} />
              <Field label="Invitation expiry (days)" htmlFor="s-inv" hint="How long workspace invitation links stay valid (1–90).">
                <Input id="s-inv" name="invitationExpiryDays" type="number" data-type="number" min={1} max={90} step={1} defaultValue={sec.invitationExpiryDays ?? 7} />
              </Field>
            </SettingsSection>
            <SettingsSection icon={<Lock size={24} />} tone="amber" title="Built-in Protections" description="Always on; not configurable." wide>
              <FactRows
                rows={[
                  ['Sign-in rate limiting', 'Repeated failed sign-ins are throttled by the auth server'],
                  ['Sessions', 'Users can review and revoke their sessions in Account → Security'],
                  ['API access tokens', 'Short-lived (15 minutes), verified against the auth server keys'],
                  ['Audit trail', 'Administrative and security-relevant actions are logged append-only'],
                  ['Uploads', 'Validated by type and size; applicant files are malware-scanned before download'],
                ]}
              />
            </SettingsSection>
          </SettingsGrid>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>{settings.updated('platform.security')}</p>
        </ApiForm>
      )}
    </SettingsShell>
  );
}
