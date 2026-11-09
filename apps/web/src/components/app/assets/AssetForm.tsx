import { Field, FormGrid, Input, Select, Textarea } from '@/components/ui';
import { MinorForm } from '@/components/market/forms';
import { ASSET_TYPES, CATEGORIES } from '@/lib/marketplace';
import { type Asset, RELATIONSHIPS } from '@/lib/assets';
import type { Project } from '@/lib/types';

/** Add or edit a digital asset. The relationship is the user's claim; ownership is only ever set by verification. */
export function AssetForm({ workspaceId, projects, asset }: { workspaceId: string; projects: Project[]; asset?: Asset }) {
  const a = asset;
  return (
    <MinorForm
      method={a ? 'PATCH' : 'POST'}
      path={a ? `/user/assets/${a.id}` : '/user/assets'}
      extra={a ? undefined : { workspaceId }}
      minorFields={['purchasePriceMinor']}
      redirectTo={a ? undefined : '/app/assets/{id}'}
      submitLabel={a ? 'Save changes' : 'Add Digital Asset'}
      successMessage={a ? 'Asset updated.' : 'Asset added. Verify ownership next.'}
    >
      <FormGrid>
        <Field label="Asset name" htmlFor="as-name">
          <Input id="as-name" name="name" required minLength={2} maxLength={120} defaultValue={a?.name} />
        </Field>
        <Field label="Website address" htmlFor="as-url" hint="Needed for verification and valuation.">
          <Input id="as-url" name="url" data-type="nullable" maxLength={300} placeholder="example.com" defaultValue={a?.url ?? ''} />
        </Field>
        <Field label="Asset type" htmlFor="as-type">
          <Select id="as-type" name="assetType" defaultValue={a?.assetType ?? 'WEBSITE'}>
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Your relationship" htmlFor="as-rel">
          <Select id="as-rel" name="relationship" defaultValue={a?.relationship ?? 'OWNED'}>
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category (optional)" htmlFor="as-cat">
          <Select id="as-cat" name="category" data-type="nullable" defaultValue={a?.category ?? ''}>
            <option value="">Not specified</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Linked project (optional)" htmlFor="as-proj" hint="Connects SEO audits and tasks to this asset.">
          <Select id="as-proj" name="projectId" data-type="nullable" defaultValue={a?.project?.id ?? ''}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Acquired on (optional)" htmlFor="as-date">
          <Input id="as-date" name="acquiredAt" type="date" data-type="nullable" defaultValue={a?.acquiredAt?.slice(0, 10) ?? ''} />
        </Field>
        <Field label="Purchase price (optional)" htmlFor="as-price">
          <Input id="as-price" name="purchasePriceMinor" type="number" data-type="number" min={0} step="0.01" defaultValue={a?.purchasePriceMinor !== null && a?.purchasePriceMinor !== undefined ? a.purchasePriceMinor / 100 : ''} />
        </Field>
        <Field label="Currency" htmlFor="as-cur">
          <Select id="as-cur" name="currency" defaultValue={a?.currency ?? 'USD'}>
            {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </FormGrid>
      <Field label="Notes (optional)" htmlFor="as-desc">
        <Textarea id="as-desc" name="description" data-type="nullable" maxLength={4000} rows={3} defaultValue={a?.description ?? ''} />
      </Field>
    </MinorForm>
  );
}
