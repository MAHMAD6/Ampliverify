import { ValuationPage } from '@/components/admin/valuation/ValuationPage';
import { adminGet } from '@/lib/admin-data';
import s from '@/components/admin/valuation/valuation-admin.module.css';

export const metadata = { title: 'Usage & Limits' };

type Usage = { byKind: Record<string, number>; failed: number; withMonetaryRange: number; pdfExports: number };

export default async function ValuationLimitsPage() {
  const u = await adminGet<Usage>('/admin/valuation/usage');
  const stats = u && (
    <div className={s.stats}>
      {[
        [(u.byKind.ESTIMATE ?? 0) + (u.byKind.VERIFIED ?? 0), 'Valuations (30 days)'],
        [u.byKind.VERIFIED ?? 0, 'Enhanced valuations'],
        [u.withMonetaryRange, 'With a dollar range'],
        [u.pdfExports, 'PDF downloads'],
      ].map(([v, l]) => (
        <div key={String(l)}>
          <b>{Number(v).toLocaleString('en-US')}</b>
          <small>{l}</small>
        </div>
      ))}
    </div>
  );
  return <ValuationPage title="Usage & Limits" description="Plan access, daily and monthly limits, PDF exports and credits for website valuations." sections={['access']} before={stats} />;
}
