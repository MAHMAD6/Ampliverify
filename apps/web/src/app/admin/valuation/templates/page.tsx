import { ValuationPage } from '@/components/admin/valuation/ValuationPage';

export const metadata = { title: 'Report Templates' };

export default function ValuationTemplatesPage() {
  return <ValuationPage title="Report Templates" description="Edit the disclaimer shown on every valuation report and PDF." sections={['templates']} />;
}
