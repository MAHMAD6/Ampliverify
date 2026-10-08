import { Coins, Layers, Package } from 'lucide-react';
import { Notice } from '@/components/ui';
import { CreditCostsForm, CreditPacksForm, PlanDefaultsForms } from '@/components/admin/CreditSettings';
import { loadSettings, SettingsGrid, SettingsSection, SettingsShell } from '@/components/admin/AdminSettings';
import { adminGet, type AdminPlan } from '@/lib/admin-data';

export const metadata = { title: 'Credits & Billing · Settings' };

/** Metered actions that consume credits (the API's usage feature keys). */
const METERED = [
  { key: 'seo.audit_run', label: 'SEO audit', unit: 'audit' },
  { key: 'geo.check', label: 'AI search check', unit: 'platform checked' },
  { key: 'keywords.lookup', label: 'Keyword research', unit: 'lookup' },
  { key: 'ai.action', label: 'AI action (ideas, briefs, suggestions)', unit: 'action' },
];

/** Credit costs, credit packs, the default plan and sign-up credits (`credits.*`, `billing.default_plan_code`). */
export default async function BillingSettingsPage() {
  const [settings, plans] = await Promise.all([loadSettings(), adminGet<AdminPlan[]>('/admin/plans')]);
  return (
    <SettingsShell tab="billing" about={{ title: 'Credits & Billing', text: 'What actions cost, what customers can buy, and what new or unsubscribed workspaces get. Changes apply to the next charge.' }}>
      {!settings ? (
        <Notice tone="neutral">Settings could not be loaded with your permissions.</Notice>
      ) : (
        <SettingsGrid>
          <SettingsSection icon={<Coins size={24} />} tone="amber" title="Credit Costs" description={`Credits charged per unit of usage. ${settings.updated('credits.costs')}.`}>
            <CreditCostsForm features={METERED} costs={settings.value<Record<string, number>>('credits.costs', {})} />
          </SettingsSection>
          <SettingsSection icon={<Layers size={24} />} tone="blue" title="Plan Defaults" description={`${settings.updated('billing.default_plan_code')}.`}>
            <PlanDefaultsForms plans={(plans ?? []).filter((p) => p.status === 'ACTIVE').map((p) => ({ code: p.code, name: p.name }))} defaultPlan={settings.value<string | null>('billing.default_plan_code', null)} signupGrant={settings.value<number>('credits.signup_grant', 0)} />
          </SettingsSection>
          <SettingsSection icon={<Package size={24} />} tone="green" title="Credit Packs" description={`Shown in Add Credits; paid through Stripe Checkout. ${settings.updated('credits.packs')}.`} wide>
            <CreditPacksForm packs={settings.value('credits.packs', [])} />
          </SettingsSection>
        </SettingsGrid>
      )}
    </SettingsShell>
  );
}
