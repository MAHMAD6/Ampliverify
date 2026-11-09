import type { Metadata } from 'next';
import { legalLead, legalTitle, LegalView } from '@/components/public/LegalView';

export const metadata: Metadata = { title: legalTitle('refund'), description: legalLead('refund'), alternates: { canonical: '/digital-product-refund-policy' } };

export default function Page() {
  return <LegalView docKey="refund" />;
}
