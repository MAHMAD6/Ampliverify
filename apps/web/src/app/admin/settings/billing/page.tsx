import { Coins, Gauge, Layers, Package, RotateCcw } from 'lucide-react';
import { Notice } from '@/components/ui';
import { CreditCostsForm, CreditPacksForm, CreditPolicyForm, PlanDefaultsForms, ProviderBudgetsForm } from '@/components/admin/CreditSettings';
import { loadSettings, SettingsGrid, SettingsSection, SettingsShell } from '@/components/admin/AdminSettings';
import { adminGet, type AdminPlan } from '@/lib/admin-data';

export const metadata = { title: 'Credits & Billing · Settings' };

/**
 * AI/GEO operations priced in credits (Hybrid pricing §3). Standard SEO audits
 * are not here: they use the plan's audit allowance (`limit.audit_runs`).
 */
const METERED = [
  { key: 'ai.suggestion', label: 'AI content suggestion (editor request)', unit: 'request' },
  { key: 'ai.seo_optimization', label: 'AI SEO optimization (full editor pass)', unit: 'request' },
  { key: 'ai.action_plan', label: 'AI-generated action plan', unit: 'plan' },
  { key: 'ai.content_ideas', label: 'AI content ideas', unit: 'request' },
  { key: 'ai.content_brief', label: 'AI content brief', unit: 'brief' },
  { key: 'geo.check', label: 'GEO visibility check', unit: 'search surface observed' },
  { key: 'keywords.lookup', label: 'Keyword research', unit: 'lookup' },
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
          <SettingsSection icon={<Coins size={24} />} tone="amber" title="AI/GEO Credit Prices" description={`Credits per operation, shown to users before they run it. Calibrate from measured provider cost and margin; SEO audits use the audit allowance instead. ${settings.updated('credits.costs')}.`}>
            <CreditCostsForm features={METERED} costs={settings.value<Record<string, number>>('credits.costs', {})} />
          </SettingsSection>
          <SettingsSection icon={<Layers size={24} />} tone="blue" title="Plan Defaults" description={`${settings.updated('billing.default_plan_code')}.`}>
            <PlanDefaultsForms plans={(plans ?? []).filter((p) => p.status === 'ACTIVE').map((p) => ({ code: p.code, name: p.name }))} defaultPlan={settings.value<string | null>('billing.default_plan_code', null)} signupGrant={settings.value<number>('credits.signup_grant', 0)} />
          </SettingsSection>
          <SettingsSection icon={<RotateCcw size={24} />} tone="blue" title="Subscription Credits" description={`Plan credits (feature "AI/GEO credits per billing period") are granted each period and spent before purchased credits. ${settings.updated('credits.policy')}.`}>
            <CreditPolicyForm rollover={!!settings.value<{ rollover?: boolean }>('credits.policy', {}).rollover} />
          </SettingsSection>
          <SettingsSection icon={<Gauge size={24} />} tone="red" title="Provider Budgets" description={`Monthly USD ceilings: requests pause at the ceiling and staff are alerted at the threshold. ${settings.updated('providers.budgets')}.`}>
            <ProviderBudgetsForm budgets={settings.value<Record<string, number | null>>('providers.budgets', {})} />
          </SettingsSection>
          <SettingsSection icon={<Package size={24} />} tone="green" title="Credit Packs" description={`Shown in Add Credits; paid through Stripe Checkout. ${settings.updated('credits.packs')}.`} wide>
            <CreditPacksForm packs={settings.value('credits.packs', [])} />
          </SettingsSection>
        </SettingsGrid>
      )}
    </SettingsShell>
  );
}
