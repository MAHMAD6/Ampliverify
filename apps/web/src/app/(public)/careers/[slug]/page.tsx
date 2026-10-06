import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/public/ArticleLayout';
import { Button, Notice } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { JobDetail } from '@/lib/types';
import { jobChips } from '@/components/public/jobs';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const result = await apiGet<JobDetail>(`/public/careers/${encodeURIComponent(slug)}`);
  if (!result.ok) notFound();
  return result.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await load((await params).slug);
  return { title: job.seoTitle ?? job.title, description: job.metaDescription ?? job.summary ?? undefined };
}

/**
 * Applications are stored privately and validated server-side (guide §15). The
 * submission endpoint is not built yet, so the apply action is disabled.
 */
export default async function JobPage({ params }: Props) {
  const job = await load((await params).slug);
  const meta = [...jobChips(job), job.compensationText, job.applicationDeadline && `Apply by ${formatDate(job.applicationDeadline)}`].filter(Boolean).join('  •  ');
  return (
    <ArticleLayout
      align="left"
      category="Careers"
      title={job.title}
      summary={job.summary}
      meta={meta}
      body={job.description}
      tocTitle="Role details"
      breadcrumb={[{ label: 'Careers', href: '/careers' }, { label: job.title }]}
      emptyBody="The full role description will be available soon."
      footer={
        <div style={{ marginTop: 28, display: 'grid', gap: 12, maxWidth: 520 }}>
          <Button variant="green" size="lg" disabled>
            Apply for this role
          </Button>
          <Notice tone="green">Online applications are not open yet for this role.</Notice>
        </div>
      }
    />
  );
}
