import { Coins, Globe2, KeyRound, Settings } from 'lucide-react';
import { Field, Input, Notice, Select, SettingRow, Textarea } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import { ApiForm } from '@/components/ui/actions';
import { loadSettings, SettingsGrid, SettingsSection, SettingsShell } from '@/components/admin/AdminSettings';

export const metadata = { title: 'General · Settings' };

type General = { platformName?: string; platformUrl?: string; supportEmail?: string; defaultTimezone?: string; defaultLanguage?: string; allowSignup?: boolean; maintenanceMode?: boolean; maintenanceMessage?: string; lowCreditThreshold?: number };

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
const LANGUAGES = [
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['pt', 'Portuguese'],
  ['it', 'Italian'],
];

/** General platform settings (`platform.general`). */
export default async function GeneralSettingsPage() {
  const settings = await loadSettings();
  const g = settings?.value<General>('platform.general', {}) ?? {};
  return (
    <SettingsShell tab="general" about={{ title: 'About Settings', text: 'These settings control platform-wide behavior. Every change is recorded in the audit log with its before and after values.' }}>
      {!settings ? (
        <Notice tone="neutral">Settings could not be loaded with your permissions.</Notice>
      ) : (
        <ApiForm method="PUT" path="/admin/settings/platform.general" wrap="value" submitLabel="Save General Settings" successMessage="Settings saved.">
          <SettingsGrid>
            <SettingsSection icon={<Settings size={24} />} tone="blue" title="Platform Information" description="Shown on the website contact page and used as the reply address for staff alerts.">
              <Field label="Platform name" htmlFor="g-name">
                <Input id="g-name" name="platformName" maxLength={80} defaultValue={g.platformName ?? 'AmpliVerify'} />
              </Field>
              <Field label="Platform URL" htmlFor="g-url">
                <Input id="g-url" name="platformUrl" type="url" maxLength={200} defaultValue={g.platformUrl ?? ''} placeholder="https://ampliverify.com" />
              </Field>
              <Field label="Support email" htmlFor="g-mail" hint="Also receives staff alerts (see Notifications).">
                <Input id="g-mail" name="supportEmail" type="email" maxLength={254} defaultValue={g.supportEmail ?? ''} placeholder="support@yourcompany.com" />
              </Field>
            </SettingsSection>
            <SettingsSection icon={<Globe2 size={24} />} tone="green" title="New Workspace Defaults" description="Applied when a workspace is created; owners can change them later.">
              <Field label="Default time zone" htmlFor="g-tz">
                <Select id="g-tz" name="defaultTimezone" defaultValue={g.defaultTimezone ?? 'UTC'}>
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Default language" htmlFor="g-lang">
                <Select id="g-lang" name="defaultLanguage" defaultValue={g.defaultLanguage ?? 'en'}>
                  {LANGUAGES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </SettingsSection>
            <SettingsSection icon={<KeyRound size={24} />} tone="purple" title="Access" description="Who can sign up and use the product.">
              <SettingRow title="Allow new sign-ups" description="When off, only people with a pending workspace invitation can create an account." control={<Toggle label="Allow new sign-ups" name="allowSignup" defaultChecked={g.allowSignup !== false} />} />
              <SettingRow title="Maintenance mode" description="Product pages refuse requests for everyone except platform administrators. The public website stays up." control={<Toggle label="Maintenance mode" name="maintenanceMode" defaultChecked={g.maintenanceMode === true} />} />
              <Field label="Maintenance message" htmlFor="g-mm">
                <Textarea id="g-mm" name="maintenanceMessage" rows={2} maxLength={300} defaultValue={g.maintenanceMessage ?? ''} placeholder="AmpliVerify is undergoing scheduled maintenance. Please try again shortly." />
              </Field>
            </SettingsSection>
            <SettingsSection icon={<Coins size={24} />} tone="amber" title="Credits" description="Credit balance warnings for workspaces.">
              <Field label="Low-credit warning threshold" htmlFor="g-low" hint="Owners are notified and the dashboard warns when the balance falls to or below this. 0 = off.">
                <Input id="g-low" name="lowCreditThreshold" type="number" data-type="number" min={0} step={1} defaultValue={g.lowCreditThreshold ?? 0} />
              </Field>
            </SettingsSection>
          </SettingsGrid>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>{settings.updated('platform.general')}</p>
        </ApiForm>
      )}
    </SettingsShell>
  );
}
