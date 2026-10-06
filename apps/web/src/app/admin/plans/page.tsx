import { BadgeCheck, Plus } from 'lucide-react';
import { AdminHeader, Guidelines, ListPanel, MetricRow } from '@/components/admin/AdminParts';
import { Button, Field, Grid, Notice, Panel, Select } from '@/components/ui';
import { Toggle } from '@/components/ui/Toggle';
import s from '@/components/admin/parts.module.css';

export const metadata = { title: 'Plans & Pricing' };

export default function PlansPage() {
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        title="Plans & Pricing"
        description="Manage plan definitions and public pricing controls. Prices and limits come from the billing configuration."
        actions={
          <Button icon={<Plus size={16} />} disabled>
            Add Plan
          </Button>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice title="Plan configuration:">This page controls backend plan definitions and what the public Pricing page shows. Entitlements are managed separately under Feature Entitlements.</Notice>
      </div>
      <MetricRow
        items={[
          { label: 'Active Plans', note: 'Loaded from billing configuration' },
          { label: 'Monthly Plans', note: 'No billing data loaded' },
          { label: 'Annual Plans', note: 'No billing data loaded' },
          { label: 'Archived Plans', note: 'No archived plans' },
        ]}
      />
      <ListPanel
        title="Plans"
        description="Configure plan identity, availability, billing interval, and public visibility."
        search="Search plans..."
        selects={['All statuses', 'All intervals']}
        columns={['Plan', 'Code', 'Status', 'Prices', 'Public', 'Actions']}
        emptyIcon={<BadgeCheck size={26} />}
        emptyTitle="No billing plans loaded"
        emptyText="Create a plan when the product owner has finalized its commercial settings."
      />
      <Grid cols={2} style={{ marginTop: 16 }}>
        <Panel title="Public Pricing Controls" description="Define what the pricing page can display.">
          <div className={s.row}>
            <span>Show monthly / annual selector</span>
            <Toggle label="Show monthly / annual selector" disabled />
          </div>
          <div className={s.row}>
            <span>Show feature comparison</span>
            <Toggle label="Show feature comparison" disabled />
          </div>
          <div className={s.row}>
            <span>Highlight recommended plan</span>
            <Toggle label="Highlight recommended plan" disabled />
          </div>
          <Field label="Recommended plan" htmlFor="pl-rec">
            <Select id="pl-rec" disabled>
              <option>Not configured</option>
            </Select>
          </Field>
        </Panel>
        <Guidelines
          title="Billing Guardrails"
          description="Keep commercial changes deliberate and auditable."
          items={[
            'Require confirmation before changing a live price.',
            'Record administrator, timestamp, and before/after values for plan changes.',
            'Do not automatically alter existing subscriptions when a plan definition changes.',
            'Keep entitlements managed separately under Feature Entitlements.',
          ]}
        />
      </Grid>
    </>
  );
}
