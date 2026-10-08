'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Input } from '../ui';
import { ActionMessage } from '../ui/actions';
import { revokeUserSessions, setUserStatus } from '@/lib/admin-actions';

type Kind = { type: 'revoke'; sessionId?: string } | { type: 'suspend' } | { type: 'reactivate' };

/** A consequential admin action that requires a written reason (recorded in the audit log). */
export function ReasonAction({ userId, kind, label, variant = 'outline' }: { userId: string; kind: Kind; label: string; variant?: 'outline' | 'ghost' | 'primary' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (!open)
    return (
      <span>
        <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
          {label}
        </Button>
        <ActionMessage success={done} />
      </span>
    );
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason" style={{ minWidth: 180 }} />
      <Button
        size="sm"
        disabled={pending || reason.trim().length < 3}
        onClick={() =>
          start(async () => {
            setError(null);
            const r =
              kind.type === 'revoke' ? await revokeUserSessions(userId, reason.trim(), kind.sessionId) : await setUserStatus(userId, kind.type === 'suspend' ? 'SUSPENDED' : 'ACTIVE', reason.trim());
            if (!r.ok) return setError(r.message);
            setOpen(false);
            setReason('');
            setDone(kind.type === 'revoke' ? 'Signed out.' : kind.type === 'suspend' ? 'Suspended and signed out.' : 'Reactivated.');
            router.refresh();
          })
        }
      >
        {pending ? 'Working…' : 'Confirm'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <ActionMessage error={error} />
    </span>
  );
}
