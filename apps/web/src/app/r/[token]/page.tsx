import { notFound } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { ReportSections, type SectionPayload } from '@/components/app/reports/ReportSections';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Shared report', robots: { index: false, follow: false } };

type PublicReport = { title: string; type: string; projectName: string; periodStart: string | null; periodEnd: string | null; createdAt: string; sections: SectionPayload[] };

/** Read-only report opened from a share link. */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const res = await apiGet<PublicReport>(`/public/reports/${encodeURIComponent((await params).token)}`, { revalidate: 0 });
  if (!res.ok) notFound();
  const r = res.data;
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px' }}>
      <header style={{ borderBottom: '3px solid #16B364', paddingBottom: 16, marginBottom: 24 }}>
        <Logo />
        <h1 style={{ margin: '12px 0 4px' }}>{r.title}</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          {r.projectName}
          {r.periodStart ? ` · ${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}` : ''} · Generated {formatDate(r.createdAt)}
        </p>
      </header>
      <ReportSections sections={r.sections} />
      <footer style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>Shared from AmpliVerify. This link may expire.</footer>
    </main>
  );
}
