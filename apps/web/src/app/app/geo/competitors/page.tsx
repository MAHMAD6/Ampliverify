import { Users } from 'lucide-react';
import { Field, Input } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { StateView } from '@/components/ui/StateView';
import { GeoShell, GeoTable, geoPeriod, loadGeo, pct } from '@/components/app/geo/GeoShell';
import { apiGet, qs } from '@/lib/api';
import s from '@/components/app/geo/geo.module.css';

export const metadata = { title: 'Competitors · AI Search (GEO)' };

type Competitors = {
  answers: number;
  brand: { mentions: number; visibility: number | null };
  competitors: { id: string; name: string; domain: string | null; mentions: number; visibility: number | null; avgPosition: number | null }[];
};

/** Competitor visibility in AI answers (`geo_competitors`, `geo_competitor_mentions`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = geoPeriod((await searchParams).period);
  const { project, overview } = await loadGeo(period);
  const res = project ? await apiGet<Competitors>(`/user/projects/${project.id}/geo/competitors${qs({ period })}`, { auth: true }) : null;
  const data = res?.ok ? res.data : null;
  const all = data ? data.brand.mentions + data.competitors.reduce((n, c) => n + c.mentions, 0) : 0;
  const sov = (n: number) => (all ? `${Math.round((n / all) * 100)}%` : '—');
  return (
    <GeoShell tab="competitors" period={period}>
      {project && (
        <ApiForm path={`/user/projects/${project.id}/geo/competitors`} submitLabel="Add Competitor" resetOnSuccess successMessage="Competitor added.">
          <div className={s.inlineForm}>
            <Field label="Competitor name" htmlFor="gc-name">
              <Input id="gc-name" name="name" required minLength={2} maxLength={120} placeholder="e.g. Acme SEO" />
            </Field>
            <Field label="Website (optional)" htmlFor="gc-domain">
              <Input id="gc-domain" name="domain" data-type="nullable" maxLength={253} placeholder="acme.com" />
            </Field>
          </div>
        </ApiForm>
      )}
      <GeoTable
        columns={['Brand', 'Mentions', 'Visibility', 'Share of Voice', 'Avg. Position', 'Actions']}
        rows={
          data && data.competitors.length
            ? [
                [<b key="b">{project?.name ?? 'Your brand'} (you)</b>, data.brand.mentions, pct(data.brand.visibility), sov(data.brand.mentions), overview?.avgPosition ?? '—', ''],
                ...data.competitors.map((c) => [
                  <span key="c">
                    <b>{c.name}</b>
                    {c.domain && <span className={s.sub}>{c.domain}</span>}
                  </span>,
                  c.mentions,
                  pct(c.visibility),
                  sov(c.mentions),
                  c.avgPosition ?? '—',
                  <ActionButton key="r" size="sm" variant="ghost" method="DELETE" path={`/user/geo/competitors/${c.id}`} confirm={`Stop tracking ${c.name}?`}>
                    Remove
                  </ActionButton>,
                ]),
              ]
            : []
        }
        empty={<StateView kind="empty" compact icon={<Users size={28} />} title="No competitors tracked" description="Add competitors above. Each prompt check then records which of them AI answers mention." />}
      />
      {data && data.answers > 0 && <p className={s.sub}>Based on the latest answer for each prompt and platform in this period ({data.answers} answers).</p>}
    </GeoShell>
  );
}
