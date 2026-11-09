import { redirect } from 'next/navigation';
import { DOC_HREF } from '@/components/public/LegalView';

/** Old /legal?doc= links now live at their own routes. */
export default async function LegalPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc } = await searchParams;
  redirect(DOC_HREF[doc ?? 'privacy'] ?? '/privacy');
}
