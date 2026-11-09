import type { Metadata } from 'next';
import { legalLead, legalTitle, LegalView } from '@/components/public/LegalView';

export const metadata: Metadata = { title: legalTitle('terms'), description: legalLead('terms'), alternates: { canonical: '/terms' } };

export default function Page() {
  return <LegalView docKey="terms" />;
}
