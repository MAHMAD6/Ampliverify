import { CircleCheck } from 'lucide-react';
import { Button, ButtonLink, Field, Input, Notice, Panel, Select, Textarea } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import s from '@/components/admin/audit.module.css';

export const metadata = { title: 'Feature Flag Detail' };

/**
 * Feature Flag Detail / Rollout (admin-final-batch3/03). Flags are operational
 * controls, separate from RBAC and plan entitlements. No feature-flag admin
 * API exists yet, so the form is disabled and history is empty.
 */
export default function FeatureFlagDetailPage() {
  return (
    <>
      <AdminHeader section="System Operations" parent={{ label: 'Feature Flags', href: '/admin/flags' }} page="Flag Detail" title="Feature Flag Detail / Rollout" description="Configure a controlled feature rollout with explicit production safeguards." />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="neutral">
          <b>Rollout safety:</b> feature flags are operational controls. They never replace RBAC, subscription entitlements, or backend authorization checks.
        </Notice>
      </div>
      <div className={s.split} style={{ marginTop: 0 }}>
        <Panel title="Flag Configuration" description="The controlled rollout record." flushHead>
          <Field label="Flag name" htmlFor="f-name">
            <Input id="f-name" placeholder="Enter feature flag name" disabled />
          </Field>
          <Field label="Key" htmlFor="f-key" hint="Stable identifier used by the backend.">
            <Input id="f-key" placeholder="Enter stable flag key" disabled />
          </Field>
          <Field label="Environment" htmlFor="f-env">
            <Select id="f-env" disabled defaultValue="">
              <option value="">Development / Staging / Production</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="f-desc">
            <Textarea id="f-desc" rows={3} placeholder="Describe the capability and operational purpose." disabled />
          </Field>
        </Panel>
        <Panel title="Rollout" description="How the feature becomes available." flushHead>
          <Field label="Rollout mode" htmlFor="f-mode">
            <Select id="f-mode" disabled defaultValue="">
              <option value="">Off / Everyone / Percentage / Cohort</option>
            </Select>
          </Field>
          <Field label="Percentage" htmlFor="f-pct">
            <Input id="f-pct" placeholder="Not configured" disabled />
          </Field>
          <Field label="Cohort / segment" htmlFor="f-cohort">
            <Input id="f-cohort" placeholder="Not configured" disabled />
          </Field>
          <Field label="Scheduled change" htmlFor="f-sched">
            <Input id="f-sched" placeholder="Not configured" disabled />
          </Field>
        </Panel>
        <Panel title="Safeguards" description="Production changes are deliberate and reversible." flushHead>
          <ul className={s.checks}>
            <li>
              <CircleCheck size={16} /> Production changes require confirmation.
            </li>
            <li>
              <CircleCheck size={16} /> Before/after state and rollout criteria are recorded.
            </li>
            <li>
              <CircleCheck size={16} /> Immediate rollback to the prior safe state is available.
            </li>
            <li>
              <CircleCheck size={16} /> Flags are never used to bypass entitlements or authorization.
            </li>
          </ul>
        </Panel>
        <Panel title="Change History" description="Operational changes for this flag." flushHead>
          <div className={s.timeline}>
            <b>No flag changes recorded</b>
            Real administrator changes will appear after the flag exists.
          </div>
        </Panel>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <ButtonLink href="/admin/flags" variant="outline">
          Cancel
        </ButtonLink>
        <Button variant="outline" disabled>
          Save Draft
        </Button>
        <Button disabled>Review Production Change</Button>
      </div>
    </>
  );
}
