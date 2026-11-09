import { PageHeader } from '@/components/ui';
import { browseQuery, type BrowseParams, BrowseView } from '@/components/market/BrowseView';
import { apiGet, qs } from '@/lib/api';
import type { BrowsePage } from '@/lib/marketplace';

export const metadata = { title: 'Browse Digital Assets · Marketplace' };

export default async function BuyerBrowsePage({ searchParams }: { searchParams: Promise<BrowseParams> }) {
  const sp = await searchParams;
  const res = await apiGet<BrowsePage>(`/user/marketplace/listings${qs(browseQuery(sp).params)}`, { auth: true });
  return (
    <>
      <PageHeader title="Browse Digital Assets" description="Websites, online businesses and digital products listed by their owners and reviewed by our team." />
      <BrowseView data={res.ok ? res.data : null} sp={sp} base="/buyer/browse" detail="buyer" />
    </>
  );
}
