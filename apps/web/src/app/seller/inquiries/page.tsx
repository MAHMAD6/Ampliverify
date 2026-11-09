import { PageHeader } from '@/components/ui';
import { InquiryList } from '@/components/market/lists';
import { apiGet } from '@/lib/api';
import type { InquiryRow } from '@/lib/marketplace';

export const metadata = { title: 'Received Inquiries · Marketplace' };

export default async function SellerInquiriesPage() {
  const res = await apiGet<InquiryRow[]>('/user/marketplace/my/inquiries?role=received', { auth: true });
  return (
    <>
      <PageHeader title="Received Inquiries" description="Introduction requests and questions from buyers. Accept an introduction to open messaging and offers." />
      <InquiryList rows={res.ok ? res.data : null} base="/seller" received />
    </>
  );
}
