import Link from 'next/link';
import { Search, Store } from 'lucide-react';
import { Badge, Button, ButtonLink, Field, Input, PageHeader, Panel, Select } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { apiGet, qs } from '@/lib/api';
import { ASSET_TYPES, assetLabel, money, type PublicListing } from '@/lib/marketplace';
import s from '@/components/app/marketplace/market.module.css';

export const metadata = { title: 'Browse Digital Assets · Marketplace' };

type Page = { items: PublicListing[]; total: number; page: number; pageSize: number };

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const sp = await searchParams;
  const type = ASSET_TYPES.some((t) => t.value === sp.type) ? sp.type : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await apiGet<Page>(`/user/marketplace/listings${qs({ q: sp.q?.slice(0, 120), type, page: page > 1 ? String(page) : undefined })}`, { auth: true });
  const data = res.ok ? res.data : null;
  const filtered = !!(sp.q || type);
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;
  return (
    <>
      <PageHeader title="Browse Digital Assets" description="Websites and digital assets listed by their owners and reviewed by our team." />
      <Panel>
        <form className={s.filters} role="search" action="/app/marketplace/browse">
          <Field label="Search" htmlFor="mq">
            <Input id="mq" name="q" defaultValue={sp.q ?? ''} placeholder="Name or description" icon={<Search size={16} />} />
          </Field>
          <Field label="Asset type" htmlFor="mt">
            <Select id="mt" name="type" defaultValue={type ?? ''}>
              <option value="">All types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Search</Button>
        </form>
      </Panel>
      <div style={{ marginTop: 16 }}>
        {!data ? (
          <Panel>
            <StateView kind="error" title="Listings could not be loaded" description={'Please try again shortly.'} />
          </Panel>
        ) : data.items.length === 0 ? (
          <Panel>
            <StateView
              kind="empty"
              icon={<Store size={40} />}
              title={filtered ? 'No listings match your search' : 'No listings yet'}
              description={filtered ? 'Try a different search or asset type.' : 'New listings appear here once they pass review. Have an asset to sell?'}
              action={filtered ? <ButtonLink href="/app/marketplace/browse" variant="outline">Clear filters</ButtonLink> : <ButtonLink href="/app/marketplace/sell">Sell a Digital Asset</ButtonLink>}
            />
          </Panel>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)' }}>
              {data.total.toLocaleString('en-US')} listing{data.total === 1 ? '' : 's'}
            </p>
            <div className={s.grid}>
              {data.items.map((l) => (
                <Link key={l.id} href={`/app/marketplace/browse/${l.id}`} className={s.card}>
                  <Badge tone="green">{assetLabel(l.assetType)}</Badge>
                  <h3>{l.title}</h3>
                  <p>{l.summary}</p>
                  <span className={s.price}>{money(l.askingPriceMinor, l.currency)}</span>
                  <span className={s.meta}>
                    {l.monthlyRevenueMinor !== null && <span>Revenue {money(l.monthlyRevenueMinor, l.currency)}/mo (seller-reported)</span>}
                    {l.monthlyVisitors !== null && <span>{l.monthlyVisitors.toLocaleString('en-US')} visitors/mo (seller-reported)</span>}
                  </span>
                </Link>
              ))}
            </div>
            {pages > 1 && (
              <nav aria-label="Pages" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                {page > 1 && (
                  <ButtonLink variant="outline" href={`/app/marketplace/browse${qs({ q: sp.q, type, page: String(page - 1) })}`}>
                    Previous
                  </ButtonLink>
                )}
                <span style={{ alignSelf: 'center', fontSize: 14 }}>
                  Page {page} of {pages}
                </span>
                {page < pages && (
                  <ButtonLink variant="outline" href={`/app/marketplace/browse${qs({ q: sp.q, type, page: String(page + 1) })}`}>
                    Next
                  </ButtonLink>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
