import { ValuationPage } from '@/components/admin/valuation/ValuationPage';

export const metadata = { title: 'Valuation Data Sources' };

export default function ValuationSourcesPage() {
  return <ValuationPage title="Data Sources" description="Enable or disable the data sources used for valuations and check their configuration and recent usage." sections={['sources', 'confidence']} />;
}
