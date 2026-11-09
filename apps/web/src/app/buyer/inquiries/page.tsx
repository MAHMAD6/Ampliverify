import { PageHeader } from '@/components/ui';
import { InquiryList } from '@/components/market/lists';
import { apiGet } from '@/lib/api';
import type { InquiryRow } from '@/lib/marketplace';

export const metadata = { title: 'My Inquiries · Marketplace' };

export default async function BuyerInquiriesPage() {
  const res = await apiGet<InquiryRow[]>('/user/marketplace/my/inquiries?role=sent', { auth: true });
  return (
    <>
      <PageHeader title="My Inquiries" description="Introduction requests and questions you sent. Messaging opens once a seller accepts your introduction." />
      <InquiryList rows={res.ok ? res.data : null} base="/buyer" received={false} />
    </>
  );
}
