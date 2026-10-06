import { notFound } from 'next/navigation';
import { PROMPT_TABS, PromptDetail, type GeoPromptDetail, type PromptTab } from '@/components/app/geo/PromptDetail';
import { apiGet } from '@/lib/api';

export const metadata = { title: 'Prompt Detail · AI Search (GEO)' };

/** One tracked prompt. The GEO prompts API is not built yet, so this currently resolves to 404. */
export default async function PromptDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const result = await apiGet<GeoPromptDetail>(`/user/geo/prompts/${encodeURIComponent(id)}`, { auth: true });
  if (!result.ok) notFound();
  const active = (PROMPT_TABS.find(([key]) => key === tab)?.[0] ?? 'overview') as PromptTab;
  return <PromptDetail prompt={result.data} tab={active} />;
}
