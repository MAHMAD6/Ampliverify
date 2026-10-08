import { notFound } from 'next/navigation';
import { KeyValue, Notice, Panel } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { StatusPill } from '@/components/admin/AdminList';
import { FlagEditor } from '@/components/admin/FlagEditor';
import { adminGet, dateTime } from '@/lib/admin-data';
import s from '@/components/admin/audit.module.css';

export const metadata = { title: 'Feature Flag Detail' };

type Flag = {
  id: string;
  key: string;
  description: string;
  environment: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  rules: { scopeType: string; scopeValue: string; percentage: string | null; priority: number }[];
  history: { id: string; eventType: string; createdAt: string; actorUserId: string | null; reason: string | null }[];
};

/** Feature Flag Detail / Rollout (admin-final-batch3/03). */
export default async function FeatureFlagDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flag = await adminGet<Flag>(`/admin/feature-flags/${encodeURIComponent(id)}`);
  if (!flag) notFound();
  const state = !flag.enabled ? 'Off' : flag.rules.length ? 'Limited rollout' : 'On for everyone';
  return (
    <>
      <AdminHeader section="System Operations" parent={{ label: 'Feature Flags', href: '/admin/flags' }} page={flag.key} title="Feature Flag Detail / Rollout" description="Configure a controlled feature rollout with explicit production safeguards." />
      {flag.environment === 'production' && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="neutral">
            <b>Production flag:</b> changes take effect for real customers immediately. Turning the flag Off is the rollback.
          </Notice>
        </div>
      )}
      <div className={s.split} style={{ marginTop: 0 }}>
        <Panel title="Flag" flushHead>
          <KeyValue label="Key" value={<code>{flag.key}</code>} />
          <KeyValue label="Environment" value={flag.environment} />
          <KeyValue label="State" value={<StatusPill tone={!flag.enabled ? 'slate' : flag.rules.length ? 'amber' : 'green'}>{state}</StatusPill>} />
          <KeyValue label="Created" value={dateTime(flag.createdAt)} />
          <KeyValue label="Last updated" value={dateTime(flag.updatedAt)} />
        </Panel>
        <Panel title="Rollout" description="State, description and audience." flushHead>
          <FlagEditor
            id={flag.id}
            environment={flag.environment}
            enabled={flag.enabled}
            description={flag.description}
            rules={flag.rules.map((r) => ({ scopeType: r.scopeType, scopeValue: r.scopeValue, percentage: r.percentage === null ? null : Number(r.percentage), priority: r.priority }))}
          />
        </Panel>
        <Panel title="Change History" description="Audited changes to this flag, newest first." flushHead>
          {flag.history.length === 0 ? (
            <div className={s.timeline}>
              <b>No changes recorded</b>
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14 }}>
              {flag.history.map((h) => (
                <li key={h.id}>
                  <b>{h.eventType}</b> · {dateTime(h.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
