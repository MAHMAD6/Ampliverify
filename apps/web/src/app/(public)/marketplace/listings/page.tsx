import type { Metadata } from 'next';
import { PageHero } from '@/components/public/Blocks';
import { browseQuery, type BrowseParams, BrowseView } from '@/components/market/BrowseView';
import { apiGet, qs } from '@/lib/api';
import type { BrowsePage } from '@/lib/marketplace';
import s from '@/components/public/site.module.css';

export const metadata: Metadata = {
  title: 'Digital Assets for Sale',
  description: 'Browse reviewed websites, online businesses and digital products for sale on the AmpliVerify Marketplace.',
  alternates: { canonical: '/marketplace/listings' },
};

export default async function PublicListingsPage({ searchParams }: { searchParams: Promise<BrowseParams> }) {
  const sp = await searchParams;
  const res = await apiGet<BrowsePage>(`/public/marketplace/listings${qs(browseQuery(sp).params)}`, { revalidate: 30 });
  return (
    <>
      <PageHero eyebrow="Marketplace" title="Digital assets for sale" lead="Websites, online businesses and digital products, reviewed before they go live." />
      <section className={s.section} style={{ paddingTop: 32 }}>
        <div className={s.container}>
          <BrowseView data={res.ok ? res.data : null} sp={sp} base="/marketplace/listings" detail="public" />
        </div>
      </section>
    </>
  );
}
