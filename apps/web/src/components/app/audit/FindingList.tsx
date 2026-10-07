import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { Finding, Severity } from '@/lib/app-types';
import { FindingActions } from './AuditControls';

export const SEVERITY_STYLE: Record<Severity, { color: string; bg: string; label: string }> = {
  CRITICAL: { color: '#b91c1c', bg: '#fee2e2', label: 'Critical' },
  HIGH: { color: '#c2410c', bg: '#ffedd5', label: 'High' },
  MEDIUM: { color: '#a16207', bg: '#fef9c3', label: 'Medium' },
  LOW: { color: '#1d4ed8', bg: '#dbeafe', label: 'Low' },
  INFO: { color: '#475569', bg: '#f1f5f9', label: 'Info' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const st = SEVERITY_STYLE[severity];
  return <span style={{ background: st.bg, color: st.color, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>;
}

function describe(details: Record<string, unknown>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(details)) {
    if (k === 'category' || v === null || v === undefined) continue;
    if (Array.isArray(v)) parts.push(`${k}: ${v.slice(0, 5).join(', ')}${v.length > 5 ? '…' : ''}`);
    else if (typeof v !== 'object') parts.push(`${k}: ${v}`);
  }
  return parts.join(' · ');
}

/** Findings with "why it matters", guidance, evidence and actions (audit guide: what/why/where/how). */
export function FindingList({ projectId, findings, empty }: { projectId: string; findings: Finding[]; empty: string }) {
  if (!findings.length) {
    return (
      <p style={{ color: 'var(--muted)', padding: '12px 0' }}>
        <Info size={16} style={{ verticalAlign: 'middle' }} /> {empty}
      </p>
    );
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
      {findings.map((f) => (
        <li key={f.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, opacity: f.status === 'IGNORED' || f.status === 'RESOLVED' ? 0.6 : 1 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {f.priority === 1 ? <CircleAlert size={18} color="#dc2626" /> : <TriangleAlert size={18} color={f.priority === 2 ? '#ea7a0b' : '#2563eb'} />}
              <b>{f.title}</b>
              <SeverityBadge severity={f.severity} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{f.categoryLabel}</span>
              {f.status !== 'OPEN' && <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {f.status.toLowerCase().replace('_', ' ')}</span>}
            </div>
            <FindingActions projectId={projectId} finding={f} />
          </div>
          {f.why && <p style={{ margin: '8px 0 4px', color: 'var(--muted)', fontSize: 14 }}>{f.why}</p>}
          {f.guidance && (
            <p style={{ margin: '4px 0', fontSize: 14 }}>
              <b>How to fix:</b> {f.guidance}
            </p>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all' }}>
            {f.pageUrl}
            {describe(f.details) && ` · ${describe(f.details)}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
