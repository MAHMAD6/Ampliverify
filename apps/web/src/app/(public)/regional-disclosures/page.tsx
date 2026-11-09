import type { Metadata } from 'next';
import { legalLead, legalTitle, LegalView } from '@/components/public/LegalView';

export const metadata: Metadata = { title: legalTitle('regional'), description: legalLead('regional'), alternates: { canonical: '/regional-disclosures' } };

export default function Page() {
  return <LegalView docKey="regional" />;
}
