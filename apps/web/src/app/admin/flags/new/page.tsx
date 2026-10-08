import { CircleCheck } from 'lucide-react';
import { ButtonLink, Field, Input, Notice, Panel, Select, Textarea } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { AdminHeader } from '@/components/admin/AdminParts';
import s from '@/components/admin/audit.module.css';

export const metadata = { title: 'New Feature Flag' };

/**
 * Create a feature flag (admin-final-batch3/03). New flags start Off; rollout
 * rules are configured on the flag's page after creation.
 */
export default function NewFeatureFlagPage() {
  return (
    <>
      <AdminHeader section="System Operations" parent={{ label: 'Feature Flags', href: '/admin/flags' }} page="New Flag" title="Create Feature Flag" description="Configure a controlled feature rollout with explicit production safeguards." />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="neutral">
          <b>Rollout safety:</b> feature flags are operational controls. They never replace RBAC, subscription entitlements, or backend authorization checks.
        </Notice>
      </div>
      <div className={s.split} style={{ marginTop: 0 }}>
        <Panel title="Flag Configuration" description="The key is used by the backend and cannot change." flushHead>
          <ApiForm path="/admin/feature-flags" submitLabel="Create Flag" redirectTo="/admin/flags/{id}">
            <Field label="Key" htmlFor="f-key" hint="Lowercase, dots and dashes, e.g. editor.new-toolbar">
              <Input id="f-key" name="key" required minLength={2} maxLength={100} pattern="[a-z0-9._-]+" placeholder="Enter stable flag key" />
            </Field>
            <Field label="Environment" htmlFor="f-env">
              <Select id="f-env" name="environment" defaultValue="production">
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </Select>
            </Field>
            <Field label="Description" htmlFor="f-desc">
              <Textarea id="f-desc" name="description" rows={3} required maxLength={500} placeholder="Describe the capability and operational purpose." />
            </Field>
          </ApiForm>
        </Panel>
        <Panel title="Safeguards" description="Production changes are deliberate and reversible." flushHead>
          <ul className={s.checks}>
            <li>
              <CircleCheck size={16} /> New flags start Off.
            </li>
            <li>
              <CircleCheck size={16} /> Every change records before/after state in the audit log.
            </li>
            <li>
              <CircleCheck size={16} /> Turning a flag Off is an immediate rollback.
            </li>
            <li>
              <CircleCheck size={16} /> Flags are never used to bypass entitlements or authorization.
            </li>
          </ul>
          <ButtonLink href="/admin/flags" variant="outline">
            Cancel
          </ButtonLink>
        </Panel>
      </div>
    </>
  );
}
