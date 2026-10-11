import { Notice } from '@/components/ui';
import { AdminHeader } from '@/components/admin/AdminParts';
import { adminGet } from '@/lib/admin-data';
import { ValuationEditor, type EditorSection } from './ValuationEditor';
import type { AdminSettingsPayload, ChangeRow, HistoryRow, SourceRow } from './types';

/** Shared loader + header for the Website Value Calculator admin pages. */
export async function ValuationPage({ title, description, sections, before }: { title: string; description: string; sections: EditorSection[]; before?: React.ReactNode }) {
  const needs = (x: EditorSection) => sections.includes(x);
  const [payload, sources, changes, tests] = await Promise.all([
    adminGet<AdminSettingsPayload>('/admin/valuation/settings'),
    needs('sources') ? adminGet<SourceRow[]>('/admin/valuation/sources') : null,
    needs('history') ? adminGet<{ total: number; rows: ChangeRow[] }>('/admin/valuation/changes') : null,
    needs('history') || needs('model') ? adminGet<HistoryRow[]>('/admin/valuation/history?kind=TEST') : null,
  ]);
  return (
    <>
      <AdminHeader section="Website Value Calculator" title={title} description={description} />
      {before}
      {!payload ? (
        <Notice tone="neutral">Valuation settings could not be loaded with your permissions.</Notice>
      ) : (
        <ValuationEditor payload={payload} sources={sources ?? []} changes={changes ?? undefined} tests={tests ?? []} sections={sections} />
      )}
    </>
  );
}
