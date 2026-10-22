import type { AuditRunView, PageSpeedResult } from '@/lib/app-types';
import { formatDateTime, humanize } from '@/lib/format';
import s from '../audit.module.css';

const tone = (v: number | null) => (v === null ? 'var(--muted)' : v >= 90 ? 'var(--green)' : v >= 50 ? 'var(--amber)' : 'var(--red)');

function Psi({ r }: { r: PageSpeedResult }) {
  return (
    <div className={s.psi}>
      <div className={s.psiScores}>
        {(['performance', 'seo', 'accessibility', 'best-practices'] as const).map((k) => (
          <span key={k}>
            <b style={{ color: tone(r.scores[k]) }}>{r.scores[k] ?? '—'}</b>
            <small>{humanize(k)}</small>
          </span>
        ))}
      </div>
      <p className={s.psiMeta}>
        LCP {r.metrics.lcp ?? '—'} · CLS {r.metrics.cls ?? '—'} · TBT {r.metrics.tbt ?? '—'}
        {r.fieldData ? ` · Field data (CrUX): ${humanize(r.fieldData)}` : ' · No field data from Google for this page'}
      </p>
      {r.opportunities.length > 0 && (
        <ul className={s.psiList}>
          {r.opportunities.slice(0, 6).map((o) => (
            <li key={o.id}>
              {o.title}
              {o.displayValue ? <span> — {o.displayValue}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** PageSpeed Insights and DataForSEO On-Page results with their source and time (never invented when a call failed). */
export function ProviderResults({ audit }: { audit: AuditRunView }) {
  const psi = audit.pagespeed;
  const op = audit.onPage;
  if (!psi && !op) return null;
  return (
    <div className={s.cards}>
      {psi &&
        (['mobile', 'desktop'] as const)
          .filter((k) => psi[k])
          .map((k) => {
            const r = psi[k]!;
            return (
              <section key={k} className={s.card}>
                <h3>PageSpeed Insights · {k === 'mobile' ? 'Mobile' : 'Desktop'}</h3>
                {'error' in r ? <p className={s.psiMeta}>{r.error}</p> : <Psi r={r} />}
                <small className={s.source}>Source: Google PageSpeed Insights (Lighthouse){'error' in r ? '' : ` · ${formatDateTime(r.fetchedAt)}`}. Analyzes this URL only; it is not a site crawl.</small>
              </section>
            );
          })}
      {op && (
        <section className={s.card}>
          <h3>On-Page Diagnostics</h3>
          {op.error ? (
            <p className={s.psiMeta}>{op.error}</p>
          ) : (
            <>
              <div className={s.psiScores}>
                <span>
                  <b style={{ color: tone(op.onpageScore === undefined ? null : (op.onpageScore ?? null)) }}>{op.onpageScore === null || op.onpageScore === undefined ? '—' : Math.round(op.onpageScore)}</b>
                  <small>On-page score</small>
                </span>
                <span>
                  <b>{op.pagesCrawled ?? '—'}</b>
                  <small>Pages crawled</small>
                </span>
                <span>
                  <b>{op.brokenLinks ?? '—'}</b>
                  <small>Broken links</small>
                </span>
                <span>
                  <b>{op.duplicateTitles ?? '—'}</b>
                  <small>Duplicate titles</small>
                </span>
              </div>
              {op.checks && Object.keys(op.checks).length > 0 && (
                <ul className={s.psiList}>
                  {Object.entries(op.checks)
                    .slice(0, 8)
                    .map(([k, n]) => (
                      <li key={k}>
                        {humanize(k)} <span>— {n} page{n === 1 ? '' : 's'}</span>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
          <small className={s.source}>Source: {op.provider}{op.fetchedAt ? ` · ${formatDateTime(op.fetchedAt)}` : ''}</small>
        </section>
      )}
    </div>
  );
}
