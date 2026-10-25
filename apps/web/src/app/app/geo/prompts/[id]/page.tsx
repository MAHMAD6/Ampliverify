import type { ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import { GeoRecommendations } from '@/components/app/AiAssist';
import { PROMPT_TABS, PromptDetail, type PromptTab } from '@/components/app/geo/PromptDetail';
import { loadGeo } from '@/components/app/geo/GeoShell';
import { apiGet } from '@/lib/api';
import type { GeoPromptDetail } from '@/lib/app-types';
import { getBalances, getQuote, quoteText } from '@/lib/credits';
import { getAppContext } from '@/lib/project';

type GeoRecs = ComponentProps<typeof GeoRecommendations>['initial'];

export const metadata = { title: 'Prompt Detail · AI Search (GEO)' };

/** One tracked prompt with its latest answers, citations, history and opportunities. */
export default async function PromptDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; edit?: string }> }) {
  const [{ id }, { tab, edit }] = await Promise.all([params, searchParams]);
  const ctx = await getAppContext();
  const [result, geo, balances, recs, quote] = await Promise.all([
    apiGet<GeoPromptDetail>(`/user/geo/prompts/${encodeURIComponent(id)}`, { auth: true }),
    loadGeo('30d'),
    getBalances(ctx.workspaceId),
    apiGet<GeoRecs | null>(`/user/geo/prompts/${encodeURIComponent(id)}/recommendations`, { auth: true }),
    getQuote(ctx.workspaceId, 'ai.geo_recommendations'),
  ]);
  if (!result.ok) notFound();
  const active = (PROMPT_TABS.find(([key]) => key === tab)?.[0] ?? 'overview') as PromptTab;
  return (
    <PromptDetail
      prompt={result.data}
      tab={active}
      edit={edit === '1'}
      platforms={geo.platforms}
      defaultPlatforms={geo.aiGeo.defaultPlatforms ?? []}
      creditPerPlatform={geo.creditPerPlatform}
      available={balances?.credits.available ?? null}
      recommendations={<GeoRecommendations promptId={result.data.id} initial={recs.ok ? recs.data : null} quote={(quote && quoteText(quote)) || undefined} />}
    />
  );
}
