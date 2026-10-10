import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/public/ArticleLayout';
import { apiGet } from '@/lib/api';
import { formatDate, readingTime } from '@/lib/format';

type Props = { params: Promise<{ slug: string }> };
type CaseStudy = { slug: string; title: string; customerName: string; industry: string | null; summary: string | null; resultsJson: { label: string; value: string }[] | null; seoTitle: string | null; metaDescription: string | null; publishedAt: string; updatedAt: string; body: string | null };

async function load(slug: string) {
  const result = await apiGet<CaseStudy>(`/public/case-studies/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).slug);
  return { title: c.seoTitle ?? c.title, description: c.metaDescription ?? c.summary ?? undefined };
}

export default async function CaseStudyPage({ params }: Props) {
  const c = await load((await params).slug);
  const results = (c.resultsJson ?? []).map((r) => `- **${r.label}:** ${r.value}`).join('\n');
  const body = results ? `## Results\n\n${results}\n\n${c.body ?? ''}` : c.body;
  return (
    <ArticleLayout
      category={[c.customerName, c.industry].filter(Boolean).join(' · ')}
      title={c.title}
      summary={c.summary}
      meta={[formatDate(c.publishedAt), readingTime(c.body)].filter(Boolean).join('  •  ')}
      body={body}
      breadcrumb={[{ label: 'Case Studies', href: '/case-studies' }, { label: c.title }]}
    />
  );
}
