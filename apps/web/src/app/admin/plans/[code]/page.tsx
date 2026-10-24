import { notFound } from 'next/navigation';
import { Panel } from '@/components/ui';
import { PlanEditor } from '@/components/admin/PlanEditor';
import { adminGet, type AdminPlan } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Plan Detail · Plans & Pricing' };

type Version = { version: number; createdAt: string; changedBy: string; entitlements: { key: string; enabled: boolean; limit: string | null }[] };

export default async function PlanDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code);
  const [plan, versions] = await Promise.all([adminGet<AdminPlan>(`/admin/plans/${encodeURIComponent(code)}`), adminGet<Version[]>(`/admin/plans/${encodeURIComponent(code)}/entitlement-versions`)]);
  if (!plan) notFound();
  return (
    <>
      <PlanEditor plan={plan} />
      <div style={{ marginTop: 16 }}>
        <Panel title="Entitlement History" description="Every saved rule set is kept as an immutable version. Changes never alter credits already granted.">
          {!versions?.length ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No versions recorded yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {versions.map((v, i) => {
                const prev = versions[i + 1];
                const changed = prev ? v.entitlements.filter((e) => { const p = prev.entitlements.find((x) => x.key === e.key); return !p || p.enabled !== e.enabled || p.limit !== e.limit; }) : v.entitlements;
                return (
                  <details key={v.version} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 14 }}>
                      <b>Version {v.version}</b> · {formatDateTime(v.createdAt)} · {v.changedBy} · {changed.length} change{changed.length === 1 ? '' : 's'}
                    </summary>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, display: 'grid', gap: 2 }}>
                      {(changed.length ? changed : v.entitlements).map((e) => (
                        <li key={e.key}>
                          <code>{e.key}</code>: {e.enabled ? 'on' : 'off'}
                          {e.limit !== null ? ` · limit ${Number(e.limit).toLocaleString('en-US')}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
