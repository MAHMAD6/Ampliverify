import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArtHero } from '@/components/public/HeroArt';
import { Markdown } from '@/components/public/Markdown';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import s from '@/components/public/site.module.css';

type Page = { slug: string; title: string; description: string | null; body: string; publishedAt: string };

const load = (slug: string) => apiGet<Page>(`/public/pages/${encodeURIComponent(slug)}`, { revalidate: 60 });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const res = await load((await params).slug);
  return res.ok ? { title: res.data.title, description: res.data.description ?? undefined } : { title: 'Page not found' };
}

/** Pages published in Super Admin > Public Pages. Markdown only; raw HTML is not rendered. */
export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const res = await load((await params).slug);
  if (!res.ok) notFound();
  const p = res.data;
  return (
    <>
      <ArtHero art="legal" eyebrow="AmpliVerify" title={p.title} lead={p.description ?? undefined}>
        <p style={{ marginTop: 14, fontSize: 15 }}>Updated {formatDate(p.publishedAt)}</p>
      </ArtHero>
      <section className={s.section} style={{ paddingTop: 24 }}>
        <div className={s.container} style={{ maxWidth: 860 }}>
          <Markdown source={p.body} />
        </div>
      </section>
    </>
  );
}
