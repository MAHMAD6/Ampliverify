import { ContentStrategy } from '@/components/app/content/ContentStrategy';

export const metadata = { title: 'Opportunities · Content Strategy' };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return <ContentStrategy tab="ideas" status={status} />;
}
