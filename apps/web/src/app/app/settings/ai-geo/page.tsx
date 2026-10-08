import { AiGeoPreferences, type Prefs } from '@/components/app/settings/AiGeoPreferences';
import { LANGUAGES, LOCATIONS } from '@/components/app/keywords/config';
import { Field, Input, Panel } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { apiGet, apiList } from '@/lib/api';
import { getAppContext } from '@/lib/project';
import type { WorkspaceView } from '@/lib/app-types';

export const metadata = { title: 'AI & GEO Preferences · Settings' };

/** AI & GEO preferences plus the brand names GEO checks look for in AI answers. */
export default async function AiGeoPreferencesPage() {
  const { workspaceId } = await getAppContext();
  const [platforms, wsRes] = await Promise.all([
    apiList<{ key: string; name: string }>('/public/geo-platforms'),
    workspaceId ? apiGet<WorkspaceView>(`/user/workspaces/${workspaceId}`, { auth: true }) : null,
  ]);
  const ws = wsRes?.ok ? wsRes.data : null;
  const aiGeo = ws?.settings.aiGeo as (WorkspaceView['settings']['aiGeo'] & { preferences?: Partial<Prefs> }) | undefined;
  return (
    <>
      <AiGeoPreferences platforms={platforms} locations={LOCATIONS} languages={LANGUAGES} initial={aiGeo?.preferences ?? null} workspaceId={workspaceId} canEdit={!!ws?.permissions.update} />
      {ws?.permissions.update && (
        <div style={{ marginTop: 20 }}>
          <Panel title="Brand recognition" description="Names AI search checks look for when deciding whether an answer mentions you. The project name and domain are always included.">
            <ApiForm method="PATCH" path={`/user/workspaces/${ws.id}`} transform={(v) => ({ settings: { aiGeo: v } })}>
              <Field label="Brand name" htmlFor="brand">
                <Input id="brand" name="brandName" defaultValue={aiGeo?.brandName ?? ''} maxLength={120} placeholder="e.g. Acme Analytics" />
              </Field>
              <Field label="Other names (comma separated)" htmlFor="aliases" hint="Product names, abbreviations or former names.">
                <Input id="aliases" name="brandAliases" data-type="list" defaultValue={(aiGeo?.brandAliases ?? []).join(', ')} placeholder="Acme, AcmeAI" />
              </Field>
            </ApiForm>
          </Panel>
        </div>
      )}
    </>
  );
}
