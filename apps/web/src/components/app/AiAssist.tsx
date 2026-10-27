'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Lightbulb, PenLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiAction } from '@/lib/actions';
import { Button } from '@/components/ui';

type Explanation = { explanation: string; impact: string; steps: string[]; example: string; generatedAt: string };
type GeoRecs = { summary: string; recommendations: { title: string; why: string; action: string; evidence: string }[]; generatedAt: string };

const box: React.CSSProperties = { marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--line)', fontSize: 14 };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--muted)' };

/** "Explain with AI" for one audit finding (OpenAI guide §4); cached after the first request. */
export function ExplainFinding({ findingId }: { findingId: string }) {
  const [pending, start] = useTransition();
  const [data, setData] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      setError(null);
      const r = await apiAction<Explanation>('POST', `/user/audit-findings/${findingId}/explain`);
      if (r.ok) setData(r.data);
      else {
        setError(r.message ?? 'Could not explain this finding.');
        toast.error(r.message ?? 'Could not explain this finding.');
      }
    });
  return (
    <div>
      {!data && (
        <Button size="sm" variant="ghost" icon={<Lightbulb size={14} />} onClick={run} loading={pending}>
          {pending ? 'Explaining…' : 'Explain with AI'}
        </Button>
      )}
      {error && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--red, #b91c1c)' }}>{error}</p>}
      {data && (
        <div style={box}>
          <span style={label}>AI recommendation</span>
          <p style={{ margin: '6px 0' }}>{data.explanation}</p>
          {data.impact && (
            <p style={{ margin: '6px 0' }}>
              <b>Why it matters:</b> {data.impact}
            </p>
          )}
          {data.steps.length > 0 && (
            <ol style={{ margin: '6px 0', paddingLeft: 20 }}>
              {data.steps.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ol>
          )}
          {data.example && (
            <p style={{ margin: '6px 0 0' }}>
              <b>Example:</b> <code style={{ whiteSpace: 'pre-wrap' }}>{data.example}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Drafts the article from a brief, section by section, into a new editor document. */
export function DraftArticleButton({ briefId, size = 'sm', quote }: { briefId: string; size?: 'sm' | 'md'; quote?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    if (!window.confirm(`Write a full AI draft from this brief?${quote ? ` ${quote}` : ''} It is saved as an editor draft; nothing is published.`)) return;
    start(async () => {
      setError(null);
      const r = await apiAction<{ documentId: string }>('POST', `/user/content/briefs/${briefId}/draft`, undefined, ['/app/content']);
      if (r.ok) {
        toast.success('Draft written. Opening the editor…');
        router.push(`/app/editor/${r.data.documentId}`);
      } else {
        setError(r.message ?? 'Could not write the draft.');
        toast.error(r.message ?? 'Could not write the draft.');
      }
    });
  };
  return (
    <span>
      <Button size={size} variant="outline" icon={<PenLine size={14} />} onClick={run} loading={pending}>
        {pending ? 'Writing draft…' : 'Write draft with AI'}
      </Button>
      {error && <small style={{ display: 'block', color: 'var(--red, #b91c1c)' }}>{error}</small>}
    </span>
  );
}

/** GEO recommendations grounded in the latest observed AI Mode / AI Overview results (labelled inferred). */
export function GeoRecommendations({ promptId, initial, quote }: { promptId: string; initial: GeoRecs | null; quote?: string }) {
  const [pending, start] = useTransition();
  const [data, setData] = useState<GeoRecs | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    start(async () => {
      setError(null);
      const r = await apiAction<GeoRecs>('POST', `/user/geo/prompts/${promptId}/recommendations`);
      if (r.ok) {
        setData(r.data);
        toast.success('Recommendations ready.');
      } else {
        setError(r.message ?? 'Could not generate recommendations.');
        toast.error(r.message ?? 'Could not generate recommendations.');
      }
    });
  return (
    <section style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 18, background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>AI Recommendations</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>Inferred from the latest observed results — suggestions, not measurements.{quote ? ` ${quote}` : ''}</p>
        </div>
        <Button size="sm" variant={data ? 'outline' : 'primary'} icon={<Sparkles size={14} />} onClick={run} loading={pending}>
          {pending ? 'Generating…' : data ? 'Regenerate' : 'Get recommendations'}
        </Button>
      </div>
      {error && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--red, #b91c1c)' }}>{error}</p>}
      {data && (
        <>
          <p style={{ margin: '12px 0 8px', fontSize: 14 }}>{data.summary}</p>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10, fontSize: 14 }}>
            {data.recommendations.map((r, i) => (
              <li key={i}>
                <b>{r.title}</b>
                <div>{r.action}</div>
                <small style={{ color: 'var(--muted)' }}>
                  Why: {r.why} · Based on: {r.evidence}
                </small>
              </li>
            ))}
          </ol>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>Generated {new Date(data.generatedAt).toLocaleString()}</p>
        </>
      )}
    </section>
  );
}
