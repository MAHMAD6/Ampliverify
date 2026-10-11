import { ValuationPage } from '@/components/admin/valuation/ValuationPage';

export const metadata = { title: 'Valuation Engine Settings' };

/** Valuation Engine Settings (docs/design/website-value/Valuation-Engine-Admin). */
export default function ValuationEngineSettingsPage() {
  return (
    <ValuationPage
      title="Valuation Engine Settings"
      description="Configure how website values are calculated, manage data sources, set confidence rules, and control feature access."
      sections={['model', 'preview', 'sources', 'confidence', 'access', 'history']}
    />
  );
}
