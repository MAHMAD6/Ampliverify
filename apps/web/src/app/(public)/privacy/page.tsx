import type { Metadata } from 'next';
import { legalLead, legalTitle, LegalView } from '@/components/public/LegalView';

export const metadata: Metadata = { title: legalTitle('privacy'), description: legalLead('privacy'), alternates: { canonical: '/privacy' } };

export default function Page() {
  return <LegalView docKey="privacy" />;
}
