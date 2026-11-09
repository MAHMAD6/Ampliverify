import { Search } from 'lucide-react';
import { Button, ButtonLink, DataTable, Field, Input, PageHeader, Panel, Select } from '@/components/ui';
import { AssetsError, assetLink, NoAssets, NoWorkspace, OwnershipBadge, RelationshipBadge } from '@/components/app/assets/parts';
import { apiGet, qs } from '@/lib/api';
import { type Asset, RELATIONSHIPS } from '@/lib/assets';
import { formatDate } from '@/lib/format';
import { assetLabel, money } from '@/lib/marketplace';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'My Portfolio · Digital Assets' };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ q?: string; relationship?: string; archived?: string }> }) {
  const sp = await searchParams;
  const { workspaceId } = await getAppContext();
  if (!workspaceId) return <NoWorkspace />;
  const relationship = RELATIONSHIPS.some((r) => r.value === sp.relationship) ? sp.relationship : undefined;
  const res = await apiGet<Asset[]>(`/user/assets${qs({ workspaceId, q: sp.q?.slice(0, 120), relationship, archived: sp.archived === '1' ? '1' : undefined })}`, { auth: true });
  const filtered = !!(sp.q || relationship || sp.archived);
  return (
    <>
      <PageHeader title="My Portfolio" description="Every asset you own, manage or are authorized to work on." crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'My Portfolio' })} actions={<ButtonLink href="/app/assets/new">Add Digital Asset</ButtonLink>} />
      <Panel>
        <form className={m.filters} role="search" action="/app/assets/portfolio">
          <Field label="Search" htmlFor="pq">
            <Input id="pq" name="q" defaultValue={sp.q ?? ''} placeholder="Name or domain" icon={<Search size={16} />} />
          </Field>
          <Field label="Relationship" htmlFor="pr">
            <Select id="pr" name="relationship" defaultValue={relationship ?? ''}>
              <option value="">Owned, managed and authorized</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Show" htmlFor="pa">
            <Select id="pa" name="archived" defaultValue={sp.archived === '1' ? '1' : ''}>
              <option value="">Active assets</option>
              <option value="1">Archived assets</option>
            </Select>
          </Field>
          <Button type="submit">Apply</Button>
        </form>
      </Panel>
      <div style={{ marginTop: 16 }}>
        {!res.ok ? (
          <AssetsError />
        ) : res.data.length === 0 ? (
          <NoAssets title={filtered ? 'No assets match these filters' : 'Your portfolio is empty'} />
        ) : (
          <Panel bodyless>
            <DataTable
              columns={['Asset', 'Type', 'Domain', 'Relationship', 'Ownership', 'Purchase price', 'Project', 'Added']}
              rows={res.data.map((a) => [assetLink(a), assetLabel(a.assetType), a.domain ?? '—', <RelationshipBadge key="r" r={a.relationship} />, <OwnershipBadge key="o" status={a.ownershipStatus} />, money(a.purchasePriceMinor, a.currency), a.project?.name ?? '—', formatDate(a.createdAt)])}
            />
          </Panel>
        )}
      </div>
    </>
  );
}
