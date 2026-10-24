import { Sparkles } from 'lucide-react';
import { Badge, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { formatDateTime } from '@/lib/format';

export type Plan = { generatedAt: string; model: string; summary: string; steps: { title: string; why: string; impact: string; effort: string; timeframe: string; evidenceIds: string[] }[] } | null;

/** AI-generated action plan built from the project's findings and GEO opportunities (labelled as recommendations). */
export function ActionPlan({ projectId, plan, costNote, blocked }: { projectId: string; plan: Plan; costNote: string | null; blocked: boolean }) {
  return (
    <Panel
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Sparkles size={20} color="var(--purple, #7c5cf0)" /> AI Action Plan</span>}
      description="An ordered plan from your audit findings and AI search opportunities. These are recommendations, not measured results."
      actions={
        <ActionButton size="sm" icon={<Sparkles size={14} />} path={`/user/projects/${projectId}/action-plan`} body={{}} disabled={blocked} confirm={costNote ?? undefined} successMessage="Action plan ready.">
          {plan ? 'Regenerate Plan' : 'Generate Plan'}
        </ActionButton>
      }
      flushHead
    >
      {costNote && <small style={{ display: 'block', marginBottom: 8, color: blocked ? 'var(--red)' : 'var(--muted)' }}>{costNote}</small>}
      {!plan ? (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>Generate a plan to turn your open recommendations into prioritized steps.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14 }}>{plan.summary}</p>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
            {plan.steps.map((s) => (
              <li key={s.title} style={{ fontSize: 14 }}>
                <b>{s.title}</b> <Badge tone={s.impact === 'HIGH' ? 'green' : s.impact === 'MEDIUM' ? 'blue' : undefined}>{s.impact.toLowerCase()} impact</Badge> <Badge>{s.effort.toLowerCase()} effort</Badge> <Badge>{s.timeframe}</Badge>
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>{s.why}</div>
                {s.evidenceIds.length > 0 && <small style={{ color: 'var(--muted)' }}>Based on {s.evidenceIds.length} finding{s.evidenceIds.length === 1 ? '' : 's'}</small>}
              </li>
            ))}
          </ol>
          <small style={{ color: 'var(--muted)' }}>Generated {formatDateTime(plan.generatedAt)} · AI recommendation</small>
        </div>
      )}
    </Panel>
  );
}
