'use client';

import { Field, Input, Panel, Select, Textarea } from '@/components/ui';
import { ApiForm } from '@/components/ui/actions';
import { ASSET_TYPES } from '@/lib/marketplace';
import s from './market.module.css';

const toMinor = (v: unknown) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100));

/** Listing form; amounts are entered in major units and sent in minor units. */
export function SellForm({ workspaceId }: { workspaceId: string }) {
  return (
    <ApiForm
      path="/user/marketplace/listings"
      submitLabel="Submit for Review"
      successMessage="Listing submitted. We will notify you when it has been reviewed."
      redirectTo="/app/marketplace/listings"
      transform={(v) => ({
        workspaceId,
        title: v.title,
        assetType: v.assetType,
        url: v.url || null,
        summary: v.summary,
        description: v.description,
        currency: String(v.currency || 'USD').toUpperCase(),
        askingPriceMinor: toMinor(v.askingPrice),
        monthlyRevenueMinor: toMinor(v.monthlyRevenue),
        monthlyVisitors: v.monthlyVisitors === null ? null : Number(v.monthlyVisitors),
      })}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <Panel title="The asset">
          <div className={s.formGrid}>
            <Field label="Title" htmlFor="ms-title">
              <Input id="ms-title" name="title" required minLength={5} maxLength={160} placeholder="e.g. Established gardening blog" />
            </Field>
            <Field label="Asset type" htmlFor="ms-type">
              <Select id="ms-type" name="assetType" defaultValue="WEBSITE" required>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Website address (optional)" htmlFor="ms-url" hint="Shown to buyers.">
              <Input id="ms-url" name="url" maxLength={300} placeholder="example.com" inputMode="url" />
            </Field>
          </div>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <Field label="Short summary" htmlFor="ms-sum" hint="20–300 characters; shown on the listing card.">
              <Input id="ms-sum" name="summary" required minLength={20} maxLength={300} />
            </Field>
            <Field label="Full description" htmlFor="ms-desc" hint="At least 50 characters: what is included, how it earns, why you are selling.">
              <Textarea id="ms-desc" name="description" required minLength={50} maxLength={10000} rows={8} />
            </Field>
          </div>
        </Panel>
        <Panel title="Price and figures" description="Revenue and traffic are shown to buyers as seller-reported.">
          <div className={s.formGrid}>
            <Field label="Asking price" htmlFor="ms-price">
              <Input id="ms-price" name="askingPrice" type="number" data-type="number" min={1} step="0.01" required inputMode="decimal" />
            </Field>
            <Field label="Currency" htmlFor="ms-cur">
              <Select id="ms-cur" name="currency" defaultValue="USD">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </Field>
            <Field label="Monthly revenue (optional)" htmlFor="ms-rev">
              <Input id="ms-rev" name="monthlyRevenue" type="number" data-type="number" min={0} step="0.01" inputMode="decimal" />
            </Field>
            <Field label="Monthly visitors (optional)" htmlFor="ms-vis">
              <Input id="ms-vis" name="monthlyVisitors" type="number" data-type="number" min={0} step={1} inputMode="numeric" />
            </Field>
          </div>
        </Panel>
      </div>
    </ApiForm>
  );
}
