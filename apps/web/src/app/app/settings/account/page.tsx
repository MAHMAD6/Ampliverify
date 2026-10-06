import { Button, Badge, Field, FormGrid, Input, Panel, SettingRow, Stack } from '@/components/ui';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Account · Settings' };

/**
 * Profile values come from the authenticated profile. Security actions are
 * provided by the auth service (Better Auth) and stay disabled until it is wired.
 */
export default async function AccountSettingsPage() {
  const { me } = await getAppContext();
  return (
    <>
      <h2>Account</h2>
      <p>Manage your personal account details, security, and sign-in methods.</p>
      <Stack>
        <Panel title="Profile Information" description="Account information is loaded from your authenticated profile." actions={<Button variant="outline" disabled>Edit</Button>}>
          <FormGrid>
            <Field label="Full Name" htmlFor="a-name">
              <Input id="a-name" value={me?.displayName ?? '—'} readOnly disabled />
            </Field>
            <Field label="Email Address" htmlFor="a-email">
              <Input id="a-email" value={me?.email ?? '—'} readOnly disabled />
            </Field>
            <Field label="Job Title (Optional)" htmlFor="a-title">
              <Input id="a-title" value="—" readOnly disabled />
            </Field>
            <Field label="Phone Number (Optional)" htmlFor="a-phone">
              <Input id="a-phone" value="—" readOnly disabled />
            </Field>
          </FormGrid>
        </Panel>
        <Panel title="Security" description="Manage the sign-in methods available for your account.">
          <SettingRow title="Password" description="Available when password sign-in is configured." control={<Button variant="outline" disabled>Change Password</Button>} />
          <SettingRow
            title="Multi-Factor Authentication (MFA)"
            description="Add an extra layer of account protection."
            control={
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Badge>Not enabled</Badge>
                <Button variant="outline" disabled>Enable</Button>
              </div>
            }
          />
          <SettingRow
            title="Passkeys"
            description="Use a secure passkey for supported sign-in flows."
            control={
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Badge>Not added</Badge>
                <Button variant="outline" disabled>Add Passkey</Button>
              </div>
            }
          />
          <SettingRow title="Active Sessions" description="Review devices and sessions currently signed in." control={<Button variant="outline" disabled>View Sessions</Button>} />
        </Panel>
        <Panel title="Account Preferences" description="Preferences load from your saved account settings.">
          <FormGrid>
            <Field label="Language" htmlFor="a-lang">
              <Input id="a-lang" value="—" readOnly disabled />
            </Field>
            <Field label="Timezone" htmlFor="a-tz">
              <Input id="a-tz" value="—" readOnly disabled />
            </Field>
          </FormGrid>
        </Panel>
      </Stack>
    </>
  );
}
