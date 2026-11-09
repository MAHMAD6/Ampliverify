import { Field, FormGrid, Input, Notice, PageHeader, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { AdminMarketNav } from '@/components/admin/market/AdminMarketNav';
import { SettingsForm } from '@/components/admin/market/SettingsForm';
import { adminGet } from '@/lib/admin-data';
import { money } from '@/lib/marketplace';

export const metadata = { title: 'Marketplace Settings · Admin' };

type Terms = { commissionBps: number; holdDays: number; reportingWindowDays: number; checkoutEnabled: boolean; payoutThresholdMinor: number; paymentsConfigured: boolean };

export default async function AdminMarketSettings() {
  const t = await adminGet<Terms>('/admin/marketplace/settings');
  return (
    <>
      <PageHeader title="Marketplace Settings" description="Commission, payout hold and checkout availability. Changes are audited and need the marketplace.payouts permission." />
      <AdminMarketNav active="settings" />
      {!t ? (
        <Panel>
          <StateView kind="error" title="Settings could not be loaded with your permissions." />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {!t.paymentsConfigured && (
            <Notice tone="amber" title="The payment provider is not configured.">
              Checkout and payouts stay unavailable until Stripe keys are set on the server.
            </Notice>
          )}
          <Panel title="Terms">
            <SettingsForm>
              <FormGrid>
                <Field label="Commission (%)" htmlFor="ms-comm" hint="Charged on digital product sales. 0–50%.">
                  <Input id="ms-comm" name="commissionBps" type="number" data-type="number" min={0} max={50} step="0.01" defaultValue={t.commissionBps / 100} required />
                </Field>
                <Field label="Payout hold (days)" htmlFor="ms-hold" hint="Earnings become withdrawable after this many days.">
                  <Input id="ms-hold" name="holdDays" type="number" data-type="number" min={0} max={90} defaultValue={t.holdDays} required />
                </Field>
                <Field label="Issue reporting guideline (days)" htmlFor="ms-report" hint="Shown to buyers. It never limits statutory rights.">
                  <Input id="ms-report" name="reportingWindowDays" type="number" data-type="number" min={1} max={60} defaultValue={t.reportingWindowDays} required />
                </Field>
                <Field label="Minimum payout" htmlFor="ms-min">
                  <Input id="ms-min" value={money(t.payoutThresholdMinor, 'USD')} readOnly disabled />
                </Field>
              </FormGrid>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                <input type="checkbox" name="checkoutEnabled" data-type="bool" defaultChecked={t.checkoutEnabled} disabled={!t.paymentsConfigured && !t.checkoutEnabled} />
                <span>Enable checkout for digital products</span>
              </label>
            </SettingsForm>
          </Panel>
        </div>
      )}
    </>
  );
}
