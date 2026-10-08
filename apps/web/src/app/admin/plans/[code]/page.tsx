import { notFound } from 'next/navigation';
import { PlanEditor } from '@/components/admin/PlanEditor';
import { adminGet, type AdminPlan } from '@/lib/admin-data';

export const metadata = { title: 'Plan Detail · Plans & Pricing' };

export default async function PlanDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code);
  const plan = await adminGet<AdminPlan>(`/admin/plans/${encodeURIComponent(code)}`);
  if (!plan) notFound();
  return <PlanEditor plan={plan} />;
}
