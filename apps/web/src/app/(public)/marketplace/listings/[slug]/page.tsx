import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingDetailView } from '@/components/market/ListingDetailView';
import { LoadError } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import type { ListingDetail, MarketMeta } from '@/lib/marketplace';
import s from '@/components/public/site.module.css';

const load = (slug: string) => apiGet<ListingDetail>(`/public/marketplace/listings/${encodeURIComponent(slug.slice(0, 100))}`, { revalidate: 30 });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await load(slug);
  if (!res.ok) return { title: 'Listing not found', robots: { index: false } };
  return { title: res.data.title, description: res.data.summary, alternates: { canonical: `/marketplace/listings/${res.data.slug ?? res.data.id}` }, openGraph: { title: res.data.title, description: res.data.summary } };
}

export default async function PublicListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [res, meta] = await Promise.all([load(slug), apiGet<MarketMeta>('/public/marketplace/meta', { revalidate: 60 })]);
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This listing" />;
  const l = res.data;
  const crumbsLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Marketplace', item: '/marketplace' },
      { '@type': 'ListItem', position: 2, name: 'Listings', item: '/marketplace/listings' },
      { '@type': 'ListItem', position: 3, name: l.title },
    ],
  };
  return (
    <section className={s.section} style={{ paddingTop: 32 }}>
      <div className={s.container}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbsLd).replace(/</g, '\\u003c') }} />
        <ListingDetailView l={l} meta={meta.ok ? meta.data : null} mode="public" crumbs={[{ label: 'Marketplace', href: '/marketplace' }, { label: 'Listings', href: '/marketplace/listings' }, { label: l.title }]} />
      </div>
    </section>
  );
}
