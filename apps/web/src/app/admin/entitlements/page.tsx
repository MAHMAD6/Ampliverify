import { Plus, Settings2 } from 'lucide-react';
import { AdminHeader, FilterBar, Guidelines, MetricRow } from '@/components/admin/AdminParts';
import { Button, Grid, KeyValue, Notice, Panel } from '@/components/ui';
import { apiList } from '@/lib/api';
import type { PublicPlan } from '@/lib/types';
import s from '@/components/admin/parts.module.css';

export const metadata = { title: 'Feature Entitlements' };

/** Capability registry seeded by migration (features table). */
const FEATURES = [
  ['seo.on_page_audit', 'On-Page SEO Audit'],
  ['seo.on_page_editor', 'On-Page SEO Editor'],
  ['content.audit', 'Content Audit'],
  ['geo.audit', 'GEO Audit'],
  ['ai.suggest', 'AI Suggest'],
  ['reports.scheduled', 'Scheduled Reports'],
] as const;
const LIMITS = ['Audit runs', 'GEO queries', 'AI-assisted actions', 'Projects'];

export default async function EntitlementsPage() {
  const plans = await apiList<PublicPlan>('/public/plans');
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        title="Feature Entitlements"
        description="Map AmpliVerify features and usage limits to plans."
        actions={
          <Button icon={<Plus size={16} />} disabled>
            Add Entitlement
          </Button>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice title="Entitlement rule:">Features and limits are resolved from plan configuration on the server. Organization overrides are explicit and time-bounded.</Notice>
      </div>
      <MetricRow
        items={[
          { label: 'Plans Configured', note: 'Loaded from plan configuration', value: plans.length || undefined },
          { label: 'Features Mapped', note: 'No entitlement data loaded' },
          { label: 'Usage Limits', note: 'No usage rules loaded' },
          { label: 'Overrides', note: 'No active overrides' },
        ]}
      />
      <Panel
        title="Feature Entitlement Matrix"
        description="Control which product capabilities are available by plan."
        bodyless
        actions={
          <Button variant="secondary" icon={<Settings2 size={16} />} disabled>
            Manage Features
          </Button>
        }
      >
        <FilterBar search="Search features..." selects={['All modules', 'All plans']} />
        <div style={{ overflowX: 'auto' }}>
          <table className={s.matrix}>
            <thead>
              <tr>
                <th>Feature</th>
                {plans.length ? plans.map((p) => <th key={p.code}>{p.name}</th>) : <th>No plans configured</th>}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(([key, name]) => (
                <tr key={key}>
                  <td>{name}</td>
                  {plans.length ? (
                    plans.map((p) => {
                      const e = p.entitlements.find((x) => x.feature.key === key);
                      return <td key={p.code}>{e ? (e.enabled ? 'Included' : 'Not included') : '—'}</td>;
                    })
                  ) : (
                    <td>—</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Grid cols={2} style={{ marginTop: 16 }}>
        <Panel title="Usage Limits" description="Optional quantitative rules per entitlement." flushHead>
          {LIMITS.map((l) => (
            <KeyValue key={l} label={l} value="Not configured" />
          ))}
        </Panel>
        <Guidelines
          title="Governance"
          description="Protect entitlement integrity."
          items={[
            'Require confirmation for live-plan entitlement changes.',
            'Audit all before/after values and the administrator responsible.',
            'Keep organization-specific overrides explicit and time-bounded.',
          ]}
        />
      </Grid>
    </>
  );
}
