'use client';

import { useState } from 'react';
import { Field, Select } from '../ui';
import { ApiForm } from '../ui/actions';

type Option = { id: string; label: string };

/**
 * Grants a role at a scope (POST /admin/access-assignments). The API enforces
 * anti-escalation (the grantor must already hold every permission of the
 * role at that scope) and that the person belongs to the workspace or
 * organization.
 */
export function RoleAssignForm({ users, roles, workspaces, organizations, fixedUserId }: { users?: Option[]; roles: Option[]; workspaces: Option[]; organizations: Option[]; fixedUserId?: string }) {
  const [scope, setScope] = useState('GLOBAL');
  return (
    <ApiForm path="/admin/access-assignments" submitLabel="Assign Role" resetOnSuccess successMessage="Role assigned." extra={fixedUserId ? { userId: fixedUserId } : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {!fixedUserId && (
          <Field label="User" htmlFor="ra-user">
            <Select id="ra-user" name="userId" required>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Role" htmlFor="ra-role">
          <Select id="ra-role" name="roleId" required>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scope" htmlFor="ra-scope">
          <Select id="ra-scope" name="scopeType" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="GLOBAL">Platform</option>
            <option value="ORGANIZATION">Organization</option>
            <option value="WORKSPACE">Workspace</option>
          </Select>
        </Field>
        {scope === 'ORGANIZATION' && (
          <Field label="Organization" htmlFor="ra-org">
            <Select id="ra-org" name="organizationId" required>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {scope === 'WORKSPACE' && (
          <Field label="Workspace" htmlFor="ra-ws">
            <Select id="ra-ws" name="workspaceId" required>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </ApiForm>
  );
}
