import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { DataTable, Field, FormGrid, Input, PageHeader, Panel, Select, Textarea } from '@/components/ui';
import { AssetsError, NoWorkspace } from '@/components/app/assets/parts';
import { MinorForm } from '@/components/market/forms';
import { StateView } from '@/components/ui/StateView';
import { apiGet } from '@/lib/api';
import { ANALYSIS_CHECKS, type AnalysisRow, range } from '@/lib/assets';
import { formatDateTime, humanize } from '@/lib/format';
import { ASSET_TYPES, money } from '@/lib/marketplace';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Acquisition Analyzer · Digital Assets' };

/** Analyse a site before buying it. Results are evidence-backed estimates; analysing never adds the site as owned. */
export default async function AcquisitionsPage() {
  const { workspaceId } = await getAppContext();
  if (!workspaceId) return <NoWorkspace />;
  const res = await apiGet<AnalysisRow[]>(`/user/assets/acquisitions?workspaceId=${workspaceId}`, { auth: true });
  return (
    <>
      <PageHeader title="Acquisition Analyzer" description="Check a website's SEO, traffic signals, technical quality and value range before you make an offer." crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'Acquisition Analyzer' })} />
      <div className={m.two}>
        <Panel title="Analyze a website">
          <MinorForm path="/user/assets/acquisitions" extra={{ workspaceId }} minorFields={['askingPriceMinor']} submitLabel="Run analysis" successMessage="Analysis started." redirectTo="/app/assets/acquisitions/{id}">
            <FormGrid>
              <Field label="Website address" htmlFor="aq-url">
                <Input id="aq-url" name="url" required maxLength={300} placeholder="example.com" />
              </Field>
              <Field label="Asset type" htmlFor="aq-type">
                <Select id="aq-type" name="assetType" defaultValue="WEBSITE">
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Asking price (optional)" htmlFor="aq-price">
                <Input id="aq-price" name="askingPriceMinor" type="number" data-type="number" min={0} step="0.01" />
              </Field>
              <Field label="Currency" htmlFor="aq-cur">
                <Select id="aq-cur" name="currency" defaultValue="USD">
                  {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </FormGrid>
            <fieldset style={{ border: 0, padding: 0, margin: '8px 0' }}>
              <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Checks</legend>
              <ul className={m.checks} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                {ANALYSIS_CHECKS.map((c) => (
                  <li key={c.value}>
                    <label>
                      <input type="checkbox" name="checks" value={c.value} data-type="array" defaultChecked />
                      <span>{c.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <Field label="Notes (optional)" htmlFor="aq-notes">
              <Textarea id="aq-notes" name="notes" maxLength={2000} rows={2} />
            </Field>
          </MinorForm>
        </Panel>
        <Panel title="How it works">
          <ol className={m.list}>
            <li>We crawl the public site and collect evidence from our data providers.</li>
            <li>You get a quality score and value range with its confidence and limitations.</li>
            <li>Save it as a prospective acquisition to track it in your portfolio.</li>
          </ol>
          <p className={m.muted}>Estimates are not appraisals. Verify traffic and financials with the seller during due diligence.</p>
        </Panel>
      </div>
      <div style={{ marginTop: 16 }}>
        {!res.ok ? (
          <AssetsError />
        ) : res.data.length === 0 ? (
          <Panel>
            <StateView kind="empty" icon={<ClipboardCheck size={36} />} title="No analyses yet" description="Analyze a website above to see its quality and estimated value." />
          </Panel>
        ) : (
          <Panel title="Your analyses" bodyless>
            <DataTable
              columns={['Website', 'Asking price', 'Value range', 'Quality', 'Status', 'Saved', 'Date']}
              rows={res.data.map((r) => [
                <Link key="l" href={`/app/assets/acquisitions/${r.id}`}>
                  {r.domain}
                </Link>,
                money(r.askingPriceMinor, r.currency),
                range(r.valuation),
                r.valuation?.qualityScore ?? '—',
                r.valuation ? humanize(r.valuation.status) : '—',
                r.assetId ? <Link key="a" href={`/app/assets/${r.assetId}`}>Prospect</Link> : '—',
                formatDateTime(r.createdAt),
              ])}
            />
          </Panel>
        )}
      </div>
    </>
  );
}
