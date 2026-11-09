import { Search, Store } from 'lucide-react';
import { Button, ButtonLink, Field, Input, Panel, Select } from '../ui';
import { qs } from '@/lib/api';
import { ASSET_TYPES, type BrowsePage, CATEGORIES, publicListingHref } from '@/lib/marketplace';
import { Empty, ListingTile, LoadError } from './parts';
import m from './market.module.css';

export type BrowseParams = { q?: string; type?: string; kind?: string; category?: string; sort?: string; minPrice?: string; maxPrice?: string; page?: string };

/** Clean, validated query for the browse API (prices entered in major units). */
export function browseQuery(sp: BrowseParams) {
  const type = ASSET_TYPES.some((t) => t.value === sp.type) ? sp.type : undefined;
  const kind = sp.kind === 'BUSINESS' || sp.kind === 'DIGITAL_PRODUCT' ? sp.kind : undefined;
  const category = CATEGORIES.includes(sp.category ?? '') ? sp.category : undefined;
  const sort = ['newest', 'price_asc', 'price_desc'].includes(sp.sort ?? '') ? sp.sort : undefined;
  const toMinor = (v?: string) => (v && Number(v) >= 0 ? String(Math.round(Number(v) * 100)) : undefined);
  const page = Math.max(1, Number(sp.page) || 1);
  return {
    params: { q: sp.q?.slice(0, 120) || undefined, type, kind, category, sort, minPrice: toMinor(sp.minPrice), maxPrice: toMinor(sp.maxPrice), page: page > 1 ? String(page) : undefined },
    page,
    filtered: !!(sp.q || type || kind || category || sp.minPrice || sp.maxPrice),
  };
}

/** Shared browse grid for the public Marketplace and the Buyer Dashboard. */
export function BrowseView({ data, sp, base, detail }: { data: BrowsePage | null; sp: BrowseParams; base: string; detail: 'buyer' | 'public' }) {
  const { page, filtered } = browseQuery(sp);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const link = (p: number) => `${base}${qs({ q: sp.q, type: sp.type, kind: sp.kind, category: sp.category, sort: sp.sort, minPrice: sp.minPrice, maxPrice: sp.maxPrice, page: p > 1 ? String(p) : undefined })}`;
  return (
    <>
      <Panel>
        <form className={m.filters} role="search" action={base}>
          <Field label="Search" htmlFor="mq">
            <Input id="mq" name="q" defaultValue={sp.q ?? ''} placeholder="Name or description" icon={<Search size={16} />} />
          </Field>
          <Field label="Listing type" htmlFor="mk">
            <Select id="mk" name="kind" defaultValue={sp.kind ?? ''}>
              <option value="">All</option>
              <option value="BUSINESS">Businesses & websites</option>
              <option value="DIGITAL_PRODUCT">Digital products</option>
            </Select>
          </Field>
          <Field label="Category" htmlFor="mc">
            <Select id="mc" name="category" defaultValue={sp.category ?? ''}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Asset type" htmlFor="mt">
            <Select id="mt" name="type" defaultValue={sp.type ?? ''}>
              <option value="">All types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Min price" htmlFor="mmin">
            <Input id="mmin" name="minPrice" type="number" min={0} defaultValue={sp.minPrice ?? ''} />
          </Field>
          <Field label="Max price" htmlFor="mmax">
            <Input id="mmax" name="maxPrice" type="number" min={0} defaultValue={sp.maxPrice ?? ''} />
          </Field>
          <Field label="Sort" htmlFor="ms">
            <Select id="ms" name="sort" defaultValue={sp.sort ?? 'newest'}>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </Select>
          </Field>
          <Button type="submit">Search</Button>
        </form>
      </Panel>
      <div style={{ marginTop: 16 }}>
        {!data ? (
          <LoadError what="Listings" />
        ) : data.items.length === 0 ? (
          <Empty
            icon={<Store size={40} />}
            title={filtered ? 'No listings match your search' : 'No listings yet'}
            description={filtered ? 'Try a different search or filter.' : 'New listings appear here once they pass review. Have an asset to sell?'}
            action={filtered ? <ButtonLink href={base} variant="outline">Clear filters</ButtonLink> : <ButtonLink href="/sell">Sell a Digital Asset</ButtonLink>}
          />
        ) : (
          <>
            <p className={m.muted} style={{ margin: '0 0 10px' }}>
              {data.total.toLocaleString('en-US')} listing{data.total === 1 ? '' : 's'}
            </p>
            <div className={m.grid}>
              {data.items.map((l) => (
                <ListingTile key={l.id} l={l} href={detail === 'buyer' ? `/buyer/listings/${l.id}` : publicListingHref(l)} save={detail === 'buyer'} />
              ))}
            </div>
            {pages > 1 && (
              <nav aria-label="Pages" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                {page > 1 && (
                  <ButtonLink variant="outline" href={link(page - 1)}>
                    Previous
                  </ButtonLink>
                )}
                <span style={{ alignSelf: 'center', fontSize: 14 }}>
                  Page {page} of {pages}
                </span>
                {page < pages && (
                  <ButtonLink variant="outline" href={link(page + 1)}>
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
