import type { Metadata } from 'next';
import { legalLead, legalTitle, LegalView } from '@/components/public/LegalView';

export const metadata: Metadata = { title: legalTitle('dpa'), description: legalLead('dpa'), alternates: { canonical: '/dpa' } };

export default function Page() {
  return <LegalView docKey="dpa" />;
}
