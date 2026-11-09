import type { Metadata } from 'next';
import { legalLead, legalTitle, LegalView } from '@/components/public/LegalView';

export const metadata: Metadata = { title: legalTitle('seller'), description: legalLead('seller'), alternates: { canonical: '/seller-guidelines' } };

export default function Page() {
  return <LegalView docKey="seller" />;
}
