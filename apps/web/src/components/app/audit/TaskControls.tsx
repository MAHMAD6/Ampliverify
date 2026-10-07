'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiAction } from '@/lib/actions';
import { Button, Select } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import type { Member, TaskView } from '@/lib/app-types';

const STATUSES: TaskView['status'][] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'DISMISSED'];

/** Status, assignee and "Verify fix" controls for one optimization task. */
export function TaskControls({ task, members }: { task: TaskView; members: Member[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const call = (method: 'PATCH' | 'POST', path: string, body: unknown, message?: string) =>
    start(async () => {
      setError(null);
      setNote(null);
      const r = await apiAction(method, path, body, ['/app/optimize']);
      if (!r.ok) return setError(r.message);
      if (message) setNote(message);
      router.refresh();
    });
  const verifying = task.verifications.some((v) => v.status === 'QUEUED' || v.status === 'RUNNING');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <Select aria-label="Task status" defaultValue={task.status} disabled={pending} onChange={(e) => call('PATCH', `/user/tasks/${task.id}`, { status: e.target.value })} style={{ width: 140 }}>
        {STATUSES.map((st) => (
          <option key={st} value={st}>
            {st.toLowerCase().replace('_', ' ')}
          </option>
        ))}
      </Select>
      <Select aria-label="Assignee" defaultValue={task.assignee?.id ?? ''} disabled={pending} onChange={(e) => call('PATCH', `/user/tasks/${task.id}`, { assignedTo: e.target.value || null })} style={{ width: 160 }}>
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.displayName ?? m.email}
          </option>
        ))}
      </Select>
      {task.finding && task.status !== 'DONE' && task.status !== 'DISMISSED' && (
        <Button size="sm" variant="green" icon={<ShieldCheck size={14} />} disabled={pending || verifying} onClick={() => call('POST', `/user/tasks/${task.id}/verify`, {}, 'Verification started — the page is being re-audited.')}>
          {verifying ? 'Verifying…' : 'Verify fix'}
        </Button>
      )}
      <ActionMessage error={error} success={note} />
    </div>
  );
}
