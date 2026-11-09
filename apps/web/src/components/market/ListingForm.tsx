import { Field, FormGrid, Input, Panel, Select, Textarea } from '../ui';
import { ASSET_TYPES, CATEGORIES, LISTING_KINDS, type MyListingDetail, STAGES, URL_VISIBILITY } from '@/lib/marketplace';
import { MinorForm } from './forms';
import m from './market.module.css';

const major = (minor: number | null | undefined) => (minor === null || minor === undefined ? '' : String(minor / 100));

/**
 * Create / edit a listing. Sections follow the listing wizard (type, details,
 * metrics, pricing, disclosures); figures are seller-reported and labelled so.
 * Saving keeps a draft; publishing needs staff review (no auto-approval).
 */
export function ListingForm({ listing }: { listing?: MyListingDetail }) {
  const l = listing;
  const id = (k: string) => `lf-${k}`;
  return (
    <MinorForm
      method={l ? 'PATCH' : 'POST'}
      path={l ? `/user/marketplace/my/listings/${l.id}` : '/user/marketplace/listings'}
      minorFields={['askingPriceMinor', 'monthlyRevenueMinor']}
      redirectTo={l ? undefined : '/seller/listings/{id}'}
      submitLabel={l ? 'Save changes' : 'Save draft'}
      successMessage={l ? (l.status === 'PUBLISHED' ? 'Saved. The listing goes back to review before it is live again.' : 'Listing saved.') : 'Draft saved. Add files and submit it for review.'}
    >
      <div className={m.stack}>
        <Panel title="1. Listing type" description="This decides how buyers purchase it.">
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={m.muted} style={{ marginBottom: 8 }}>
              What are you selling?
            </legend>
            <ul className={m.checks}>
              {LISTING_KINDS.map((k) => (
                <li key={k.value}>
                  <label>
                    <input type="radio" name="kind" value={k.value} defaultChecked={(l?.kind ?? 'BUSINESS') === k.value} />
                    <span>
                      <b>{k.label}</b>
                      <br />
                      <span className={m.muted}>{k.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </Panel>
        <Panel title="2. Asset details">
          <FormGrid>
            <Field label="Title" htmlFor={id('title')} hint="5–120 characters.">
              <Input id={id('title')} name="title" required minLength={5} maxLength={120} defaultValue={l?.title} />
            </Field>
            <Field label="Asset type" htmlFor={id('type')}>
              <Select id={id('type')} name="assetType" defaultValue={l?.assetType ?? 'WEBSITE'}>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" htmlFor={id('cat')}>
              <Select id={id('cat')} name="category" data-type="nullable" defaultValue={l?.category ?? ''}>
                <option value="">Choose a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Stage" htmlFor={id('stage')}>
              <Select id={id('stage')} name="stage" data-type="nullable" defaultValue={l?.stage ?? ''}>
                <option value="">Not specified</option>
                {STAGES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Website address (optional)" htmlFor={id('url')} hint="Business listings with an address get a separate ownership check.">
              <Input id={id('url')} name="url" maxLength={300} placeholder="example.com" defaultValue={l?.url ?? ''} />
            </Field>
            <Field label="Who can see the address" htmlFor={id('vis')}>
              <Select id={id('vis')} name="urlVisibility" defaultValue={l?.urlVisibility ?? 'PUBLIC'}>
                {URL_VISIBILITY.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location (optional)" htmlFor={id('loc')}>
              <Input id={id('loc')} name="location" maxLength={80} defaultValue={l?.location ?? ''} />
            </Field>
            <Field label="Language (optional)" htmlFor={id('lang')}>
              <Input id={id('lang')} name="language" maxLength={40} defaultValue={l?.language ?? ''} />
            </Field>
          </FormGrid>
          <Field label="Short summary" htmlFor={id('sum')} hint="20–300 characters, shown on listing cards.">
            <Textarea id={id('sum')} name="summary" required minLength={20} maxLength={300} rows={2} defaultValue={l?.summary} />
          </Field>
          <Field label="Full description" htmlFor={id('desc')} hint="At least 50 characters. Describe what is included, how it earns and why you are selling.">
            <Textarea id={id('desc')} name="description" required minLength={50} maxLength={10000} rows={8} defaultValue={l?.description} />
          </Field>
          <Field label="Highlights (optional)" htmlFor={id('hl')} hint="One per line, up to 8.">
            <Textarea id={id('hl')} name="highlights" data-type="list" rows={3} defaultValue={l?.highlights.join('\n')} />
          </Field>
        </Panel>
        <Panel title="3. Metrics and pricing" description="Revenue and traffic are seller-reported unless verified by our team.">
          <FormGrid>
            <Field label="Price" htmlFor={id('price')} hint="Asking price for businesses, fixed price for digital products.">
              <Input id={id('price')} name="askingPriceMinor" data-type="number" type="number" min={1} step="0.01" required defaultValue={major(l?.askingPriceMinor)} />
            </Field>
            <Field label="Currency" htmlFor={id('cur')}>
              <Select id={id('cur')} name="currency" defaultValue={l?.currency ?? 'USD'}>
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Monthly revenue (optional)" htmlFor={id('rev')}>
              <Input id={id('rev')} name="monthlyRevenueMinor" data-type="number" type="number" min={0} step="0.01" defaultValue={major(l?.monthlyRevenueMinor)} />
            </Field>
            <Field label="Monthly visitors (optional)" htmlFor={id('vis2')}>
              <Input id={id('vis2')} name="monthlyVisitors" data-type="number" type="number" min={0} step={1} defaultValue={l?.monthlyVisitors ?? ''} />
            </Field>
          </FormGrid>
        </Panel>
        <Panel title="4. Licence and disclosures">
          <Field label="Licence terms (required for digital products)" htmlFor={id('lic')} hint="What the buyer may do with the files: personal or commercial use, number of projects, resale.">
            <Textarea id={id('lic')} name="licenseTerms" maxLength={5000} rows={4} defaultValue={l?.licenseTerms ?? ''} />
          </Field>
          <ul className={m.checks} style={{ margin: '10px 0' }}>
            <li>
              <label>
                <input type="checkbox" name="aiGenerated" defaultChecked={l?.aiGenerated} />
                <span>Material parts of this asset were created with AI tools.</span>
              </label>
            </li>
          </ul>
          <Field label="AI disclosure (required if the box above is ticked)" htmlFor={id('ai')}>
            <Textarea id={id('ai')} name="aiDisclosure" maxLength={2000} rows={3} defaultValue={l?.aiDisclosure ?? ''} />
          </Field>
        </Panel>
      </div>
    </MinorForm>
  );
}
