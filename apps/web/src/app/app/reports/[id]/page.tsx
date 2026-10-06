import { notFound } from 'next/navigation';
import type { Report } from '@/components/app/reports/meta';
import { ReportView } from '@/components/app/reports/ReportView';
import { apiGet } from '@/lib/api';

export const metadata = { title: 'Report' };

/** Loads one generated report. The reports API is not built yet, so this currently resolves to 404. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await apiGet<Report>(`/user/reports/${encodeURIComponent((await params).id)}`, { auth: true });
  if (!result.ok) notFound();
  return <ReportView report={result.data} />;
}
