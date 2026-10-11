import { ValuationPage } from '@/components/admin/valuation/ValuationPage';

export const metadata = { title: 'Calculator Settings' };

export default function CalculatorSettingsPage() {
  return <ValuationPage title="Calculator Settings" description="Turn the public Website Value Calculator on or off and set its market, language, caching and free allowance." sections={['calculator']} />;
}
