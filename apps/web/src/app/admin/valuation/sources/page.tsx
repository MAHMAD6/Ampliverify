import { ValuationPage } from '@/components/admin/valuation/ValuationPage';

export const metadata = { title: 'Valuation Data Sources' };

export default function ValuationSourcesPage() {
  return <ValuationPage title="Data Sources" description="Enable or disable evidence sources, set cache lifetimes, and check configuration and recent usage." sections={['sources']} />;
}
