import { notFound } from 'next/navigation';
import { PlanEditor } from '@/components/admin/PlanEditor';
import { apiList } from '@/lib/api';
import type { PublicPlan } from '@/lib/types';

export const metadata = { title: 'Plan Detail · Plans & Pricing' };

/** Existing plan, read from the published plan list (the admin plans API, which would include drafts, is not built yet). */
export default async function PlanDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code);
  const plan = (await apiList<PublicPlan>('/public/plans')).find((p) => p.code === code);
  if (!plan) notFound();
  return <PlanEditor plan={plan} />;
}
