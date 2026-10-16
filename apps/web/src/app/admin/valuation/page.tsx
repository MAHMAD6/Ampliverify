import { ValuationPage } from '@/components/admin/valuation/ValuationPage';

export const metadata = { title: 'Valuation Engine Settings' };

/** Valuation Engine Settings (docs/design/website-value/Valuation-Engine-Admin). */
export default function ValuationEngineSettingsPage() {
  return (
    <ValuationPage
      title="Valuation Engine Settings"
      description="Publish the quality-score weights, comparable sale multiples, evidence sources and access rules. Every change creates a new methodology version."
      sections={['model', 'preview', 'comparables', 'sources', 'access', 'history']}
    />
  );
}
