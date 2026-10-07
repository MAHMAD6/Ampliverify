'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowRight, CircleCheck, EyeOff, FilePen, ListPlus, RefreshCw } from 'lucide-react';
import { apiAction } from '@/lib/actions';
import { Button } from '@/components/ui';
import { ActionMessage } from '@/components/ui/actions';
import type { Finding } from '@/lib/app-types';
import s from '../audit.module.css';

/** URL bar + "Analyze for" mode; starts a real audit run. */
export function RunAuditForm({ projectId, defaultUrl, mode, scope = 'PAGE' }: { projectId: string; defaultUrl: string; mode: string; scope?: 'PAGE' | 'SITE' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={s.runBar}
      onSubmit={(e) => {
        e.preventDefault();
        const url = String(new FormData(e.currentTarget).get('url') ?? '').trim();
        setError(null);
        start(async () => {
          const apiMode = mode === 'geo' ? 'GEO' : mode === 'both' ? 'BOTH' : 'SEO';
          const result = await apiAction<{ id: string }>('POST', `/user/projects/${projectId}/audits`, { ...(url ? { url } : {}), mode: apiMode, scope });
          if (!result.ok) return setError(result.message);
          router.push(`/app/audit?${new URLSearchParams({ ...(url && { url }), mode, run: result.data.id })}`);
        });
      }}
    >
      <input name="url" type="url" defaultValue={defaultUrl} placeholder="https://example.com/page" aria-label="Page URL" className={s.url} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Starting…' : 'Run Audit'} <ArrowRight size={18} />
      </Button>
      {error && (
        <div style={{ flexBasis: '100%' }}>
          <ActionMessage error={error} />
        </div>
      )}
    </form>
  );
}

/** Per-finding actions: create task, ignore / reopen, open the page in the editor. */
export function FindingActions({ projectId, finding, compact }: { projectId: string; finding: Finding; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; data?: unknown }>, after?: (data: unknown) => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.message ?? 'Something went wrong.');
      after?.(r.data);
      router.refresh();
    });
  const open = finding.status !== 'RESOLVED' && finding.status !== 'IGNORED';
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {finding.task ? (
        <a href="/app/optimize" style={{ fontSize: 13, color: 'var(--blue)' }}>
          <CircleCheck size={14} /> Task {finding.task.status.toLowerCase().replace('_', ' ')}
        </a>
      ) : (
        open && (
          <Button size="sm" variant="outline" icon={<ListPlus size={14} />} disabled={pending} onClick={() => run(() => apiAction('POST', `/user/projects/${projectId}/tasks`, { findingId: finding.id }, ['/app/optimize']))}>
            {compact ? 'Task' : 'Create task'}
          </Button>
        )
      )}
      {open ? (
        <Button size="sm" variant="ghost" icon={<EyeOff size={14} />} disabled={pending} onClick={() => run(() => apiAction('PATCH', `/user/findings/${finding.id}`, { status: 'IGNORED' }))}>
          Ignore
        </Button>
      ) : (
        <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} disabled={pending} onClick={() => run(() => apiAction('PATCH', `/user/findings/${finding.id}`, { status: 'OPEN' }))}>
          Reopen
        </Button>
      )}
      {!compact && (
        <Button
          size="sm"
          variant="ghost"
          icon={<FilePen size={14} />}
          disabled={pending}
          onClick={() => run(() => apiAction<{ id: string }>('POST', `/user/projects/${projectId}/editor/import`, { url: finding.pageUrl }), (d) => router.push(`/app/editor/${(d as { id: string }).id}`))}
        >
          Open in editor
        </Button>
      )}
      <ActionMessage error={error} />
    </div>
  );
}
