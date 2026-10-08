'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { apiAction } from '@/lib/actions';
import { Button, Field, Input, Select } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';

/** Invite by email; shows the accept link in case email delivery is not configured. */
export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ acceptUrl: string; emailed: boolean; email: string } | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setError(null);
        setResult(null);
        start(async () => {
          const r = await apiAction<{ acceptUrl: string; emailed: boolean; email: string }>('POST', `/user/workspaces/${workspaceId}/invitations`, { email: String(f.get('email')), roleKey: String(f.get('roleKey')) });
          if (!r.ok) return setError(r.message);
          setResult(r.data);
          form.reset();
          router.refresh();
        });
      }}
      style={{ display: 'grid', gap: 10 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(140px, 1fr) auto', gap: 10, alignItems: 'end' }}>
        <Field label="Email address" htmlFor="inv-email">
          <Input id="inv-email" name="email" type="email" required placeholder="teammate@company.com" />
        </Field>
        <Field label="Role" htmlFor="inv-role">
          <Select id="inv-role" name="roleKey" defaultValue="MEMBER">
            <option value="MEMBER">Member (view)</option>
            <option value="OWNER">Owner (full access)</option>
          </Select>
        </Field>
        <Button type="submit" icon={<UserPlus size={16} />} disabled={pending} style={{ marginBottom: 14 }}>
          {pending ? 'Inviting…' : 'Invite Member'}
        </Button>
      </div>
      {result && (
        <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
          <span>{result.emailed ? `Invitation emailed to ${result.email}.` : `Share this link with ${result.email} (email delivery is not configured):`}</span>
          {!result.emailed && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Input readOnly value={result.acceptUrl} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(result.acceptUrl)}>
                Copy
              </Button>
            </div>
          )}
        </div>
      )}
      <ActionMessage error={error} />
    </form>
  );
}

/** Role selector for one member. */
export function MemberRoleSelect({ workspaceId, userId, role, disabled }: { workspaceId: string; userId: string; role: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span style={{ display: 'inline-grid', gap: 4 }}>
      <Select
        aria-label="Role"
        defaultValue={role}
        disabled={disabled || pending}
        onChange={(e) =>
          start(async () => {
            setError(null);
            const r = await apiAction('PUT', `/user/workspaces/${workspaceId}/members/${userId}/role`, { roleKey: e.target.value });
            if (!r.ok) setError(r.message);
            router.refresh();
          })
        }
        style={{ width: 130 }}
      >
        <option value="OWNER">Owner</option>
        <option value="MEMBER">Member</option>
      </Select>
      <ActionMessage error={error} />
    </span>
  );
}
