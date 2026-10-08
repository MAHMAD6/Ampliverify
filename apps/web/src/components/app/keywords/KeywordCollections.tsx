import Link from 'next/link';
import { Layers, ListChecks } from 'lucide-react';
import { Badge, DataTable, EmptyState, Field, Input, Panel, Select, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { apiGet } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';

type ListRow = { id: string; name: string; saved: boolean; count: number; createdAt: string; createdBy: string };
type ListDetail = { id: string; name: string; saved: boolean; keywords: { id: string; keyword: string; country: string; language: string; addedAt: string; searchVolume: number | null; difficulty: number | null; cpc: number | null }[] };
type Cluster = { id: string; label: string; method: string; createdAt: string; totalVolume: number; avgDifficulty: number | null; keywords: { id: string; keyword: string; searchVolume: number | null; difficulty: number | null }[] };

/** Keyword lists (incl. Saved Keywords) for the selected project. */
export async function KeywordLists({ projectId, listId, saved }: { projectId: string; listId?: string; saved?: boolean }) {
  const res = await apiGet<ListRow[]>(`/user/projects/${projectId}/keyword-lists`, { auth: true });
  const lists = res.ok ? res.data : [];
  const target = saved ? lists.find((l) => l.saved) : lists.find((l) => l.id === listId);
  const detail = target ? await apiGet<ListDetail>(`/user/keyword-lists/${target.id}`, { auth: true }) : null;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {!saved && (
        <Panel title="Keyword Lists" description="Organize keywords for content planning, clustering and reports." bodyless>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <ApiForm path={`/user/projects/${projectId}/keyword-lists`} submitLabel="Create New List" resetOnSuccess successMessage="List created.">
              <Field label="List name" htmlFor="kl-name">
                <Input id="kl-name" name="name" required maxLength={120} placeholder="e.g. Blog topics Q4" />
              </Field>
            </ApiForm>
          </div>
          <DataTable
            columns={['List', 'Keywords', 'Created', 'Created by', 'Actions']}
            rows={lists.map((l) => [
              <Link key="n" href={`/app/keywords/lists?list=${l.id}`} style={{ color: 'var(--blue)', fontWeight: 600 }}>
                {l.name} {l.saved && <Badge>Saved</Badge>}
              </Link>,
              l.count,
              formatDate(l.createdAt),
              l.createdBy,
              <ActionButton key="d" size="sm" variant="ghost" method="DELETE" path={`/user/keyword-lists/${l.id}`} confirm={`Delete the list “${l.name}”?`}>
                Delete
              </ActionButton>,
            ])}
            empty={<EmptyState icon={<ListChecks size={30} />} title="No keyword lists yet" description="Create a list, or save keywords from any research tool." />}
          />
        </Panel>
      )}
      {(target || saved) && (
        <Panel title={saved ? 'Saved Keywords' : target!.name} description="Latest metrics from your research." bodyless>
          {target && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'grid', gap: 8 }}>
              <ApiForm path={`/user/keyword-lists/${target.id}/keywords`} submitLabel="Add Keywords" transform={(v) => ({ keywords: v.keywords })} resetOnSuccess successMessage="Keywords added.">
                <Field label="Add keywords (one per line or comma separated)" htmlFor="kl-add">
                  <Textarea id="kl-add" name="keywords" data-type="list" rows={2} required />
                </Field>
              </ApiForm>
              <ActionButton variant="outline" size="sm" path={`/user/projects/${projectId}/keyword-clusters`} body={{ listId: target.id }} redirectTo="/app/keywords/clusters" disabled={(detail?.ok ? detail.data.keywords.length : 0) < 2}>
                Cluster this list
              </ActionButton>
            </div>
          )}
          <DataTable
            columns={['Keyword', 'Volume', 'KD', 'CPC (USD)', 'Locale', 'Added', 'Actions']}
            rows={(detail?.ok ? detail.data.keywords : []).map((k) => [
              <b key="k">{k.keyword}</b>,
              formatNumber(k.searchVolume),
              k.difficulty ?? '—',
              k.cpc === null ? '—' : `$${k.cpc.toFixed(2)}`,
              `${k.language}-${k.country}`,
              formatDate(k.addedAt),
              <ActionButton key="r" size="sm" variant="ghost" path={`/user/keyword-lists/${target!.id}/keywords/remove`} body={{ keywordIds: [k.id] }}>
                Remove
              </ActionButton>,
            ])}
            empty={<EmptyState compact icon={<ListChecks size={26} />} title={saved ? 'No saved keywords yet' : 'This list is empty'} description={saved ? 'Save keywords from any research tool and they will appear here.' : 'Add keywords above.'} />}
          />
        </Panel>
      )}
    </div>
  );
}

/** Keyword clusters for the selected project. */
export async function KeywordClusters({ projectId }: { projectId: string }) {
  const [res, lists] = await Promise.all([apiGet<Cluster[]>(`/user/projects/${projectId}/keyword-clusters`, { auth: true }), apiGet<ListRow[]>(`/user/projects/${projectId}/keyword-lists`, { auth: true })]);
  const clusters = res.ok ? res.data : [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Panel title="Create Clusters" description="Group keywords that share a topic, so each cluster can become one page or content hub.">
        <ApiForm
          path={`/user/projects/${projectId}/keyword-clusters`}
          submitLabel="Create Clusters"
          transform={(v) => (v.listId ? { listId: v.listId } : { keywords: v.keywords })}
          successMessage="Clusters created."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(260px, 2fr)', gap: 12 }}>
            <Field label="From a list" htmlFor="cl-list">
              <Select id="cl-list" name="listId" data-type="optional" defaultValue="">
                <option value="">— or paste keywords —</option>
                {(lists.ok ? lists.data : []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.count})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Keywords (one per line)" htmlFor="cl-kw">
              <Textarea id="cl-kw" name="keywords" data-type="list" rows={3} />
            </Field>
          </div>
        </ApiForm>
      </Panel>
      <Panel title={`Keyword Clusters (${clusters.length})`} bodyless>
        <DataTable
          columns={['Cluster', 'Keywords', 'Total Volume', 'Avg. KD', 'Created', 'Actions']}
          rows={clusters.map((c) => [
            <div key="c">
              <b style={{ textTransform: 'capitalize' }}>{c.label}</b>
              <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 520 }}>{c.keywords.map((k) => k.keyword).join(', ')}</div>
            </div>,
            c.keywords.length,
            formatNumber(c.totalVolume),
            c.avgDifficulty ?? '—',
            formatDate(c.createdAt),
            <ActionButton key="d" size="sm" variant="ghost" method="DELETE" path={`/user/keyword-clusters/${c.id}`}>
              Delete
            </ActionButton>,
          ])}
          empty={<EmptyState icon={<Layers size={30} />} title="No clusters yet" description="Create clusters from a keyword list or a pasted set of keywords." />}
        />
      </Panel>
    </div>
  );
}
