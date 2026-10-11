import { ValuationPage } from '@/components/admin/valuation/ValuationPage';

export const metadata = { title: 'Report Templates' };

export default function ValuationTemplatesPage() {
  return <ValuationPage title="Report Templates" description="Choose the sections included in full valuation reports and PDFs, and edit the disclaimer." sections={['templates']} />;
}
