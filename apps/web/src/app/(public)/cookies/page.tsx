import type { Metadata } from 'next';
import { legalLead, legalTitle, LegalView } from '@/components/public/LegalView';

export const metadata: Metadata = { title: legalTitle('cookies'), description: legalLead('cookies'), alternates: { canonical: '/cookies' } };

export default function Page() {
  return <LegalView docKey="cookies" />;
}
