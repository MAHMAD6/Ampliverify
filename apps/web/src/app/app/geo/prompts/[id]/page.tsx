import { notFound } from 'next/navigation';
import { PROMPT_TABS, PromptDetail, type PromptTab } from '@/components/app/geo/PromptDetail';
import { loadGeo } from '@/components/app/geo/GeoShell';
import { apiGet } from '@/lib/api';
import type { GeoPromptDetail } from '@/lib/app-types';

export const metadata = { title: 'Prompt Detail · AI Search (GEO)' };

/** One tracked prompt with its latest answers, citations, history and opportunities. */
export default async function PromptDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; edit?: string }> }) {
  const [{ id }, { tab, edit }] = await Promise.all([params, searchParams]);
  const [result, geo] = await Promise.all([apiGet<GeoPromptDetail>(`/user/geo/prompts/${encodeURIComponent(id)}`, { auth: true }), loadGeo('30d')]);
  if (!result.ok) notFound();
  const active = (PROMPT_TABS.find(([key]) => key === tab)?.[0] ?? 'overview') as PromptTab;
  return <PromptDetail prompt={result.data} tab={active} edit={edit === '1'} platforms={geo.platforms} defaultPlatforms={geo.aiGeo.defaultPlatforms ?? []} creditPerPlatform={geo.creditPerPlatform} />;
}
