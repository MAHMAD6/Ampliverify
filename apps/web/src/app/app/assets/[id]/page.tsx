import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Calculator, Wallet } from 'lucide-react';
import { ButtonLink, DataTable, Field, FormGrid, Grid, Input, KeyValue, Metric, Notice, PageHeader, Panel } from '@/components/ui';
import { ActionButton, UploadForm } from '@/components/ui/actions';
import { AssetForm } from '@/components/app/assets/AssetForm';
import { AssetsError, OwnershipBadge, RelationshipBadge } from '@/components/app/assets/parts';
import { MinorForm } from '@/components/market/forms';
import { apiGet } from '@/lib/api';
import { type AssetDetail, range, verifyLabel } from '@/lib/assets';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { assetLabel, money } from '@/lib/marketplace';
import { appCrumbs } from '@/lib/nav';
import { getAppContext } from '@/lib/project';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Asset Details · Digital Assets' };

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [res, ctx] = await Promise.all([apiGet<AssetDetail>(`/user/assets/${id}`, { auth: true }), getAppContext()]);
  if (!res.ok) return res.reason === 'not_found' || res.reason === 'forbidden' ? notFound() : <AssetsError />;
  const a = res.data;
  const prospective = a.relationship === 'PROSPECTIVE';
  const latest = a.valuations.find((v) => v.status === 'COMPLETED');
  const revenue = a.financials.reduce((t, f) => t + f.revenueMinor, 0);
  const cost = a.financials.reduce((t, f) => t + f.costMinor, 0);
  return (
    <>
      <PageHeader
        title={a.name}
        description={`${assetLabel(a.assetType)}${a.domain ? ` · ${a.domain}` : ''} · added ${formatDate(a.createdAt)}`}
        crumbs={appCrumbs({ label: 'Digital Assets', href: '/app/assets' }, { label: 'My Portfolio', href: '/app/assets/portfolio' }, { label: a.name })}
        actions={
          <div className={m.actions}>
            <RelationshipBadge r={a.relationship} />
            <OwnershipBadge status={a.ownershipStatus} />
          </div>
        }
      />
      {a.archivedAt && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="neutral" title="This asset is archived.">
            <ActionButton method="PATCH" path={`/user/assets/${a.id}`} body={{ archived: false }} size="sm" variant="outline" successMessage="Asset restored.">
              Restore
            </ActionButton>
          </Notice>
        </div>
      )}
      <Grid cols={3}>
        <Metric label="Latest valuation" value={range(latest)} note={latest ? `Completed ${formatDate(latest.completedAt)}` : 'No completed valuation yet'} icon={<Calculator size={22} />} tone="purple" />
        <Metric label="Recorded revenue" value={money(revenue, a.currency)} note={a.financials.length ? `${a.financials.length} month(s), self-reported` : 'No financials recorded'} icon={<Wallet size={22} />} tone="green" />
        <Metric label="Recorded profit" value={money(revenue - cost, a.currency)} note={`Costs ${money(cost, a.currency)}`} icon={<BadgeCheck size={22} />} tone="blue" />
      </Grid>
      <div className={m.two} style={{ marginTop: 16 }}>
        <div className={m.stack}>
          {!prospective && a.verification && (
            <Panel title="Ownership verification" description="Prove you control this website with one of these methods. The asset is marked verified only when a check succeeds." actions={<OwnershipBadge status={a.ownershipStatus} />}>
              {a.ownershipStatus === 'VERIFIED' ? (
                <p style={{ margin: 0 }}>
                  <BadgeCheck size={16} color="#059669" aria-hidden /> Verified by {verifyLabel(a.verifiedMethod)} on {formatDateTime(a.verifiedAt)}.
                </p>
              ) : (
                <div className={m.stack}>
                  <div>
                    <b>DNS TXT record</b>
                    <p className={m.muted} style={{ margin: '4px 0' }}>
                      Add a TXT record on <code>{a.verification.dnsRecord.host}</code> with the value:
                    </p>
                    <code style={{ display: 'block', overflowWrap: 'anywhere', padding: 8, background: 'var(--surface-alt, #f7f9fc)', borderRadius: 8 }}>{a.verification.dnsRecord.value}</code>
                    <div style={{ marginTop: 8 }}>
                      <ActionButton path={`/user/assets/${a.id}/verify`} body={{ method: 'DNS_TXT' }} size="sm" successMessage="Check finished.">
                        Check DNS record
                      </ActionButton>
                    </div>
                  </div>
                  <div>
                    <b>Meta tag</b>
                    <p className={m.muted} style={{ margin: '4px 0' }}>
                      Add this tag inside <code>&lt;head&gt;</code> on your home page:
                    </p>
                    <code style={{ display: 'block', overflowWrap: 'anywhere', padding: 8, background: 'var(--surface-alt, #f7f9fc)', borderRadius: 8 }}>{a.verification.metaTag}</code>
                    <div style={{ marginTop: 8 }}>
                      <ActionButton path={`/user/assets/${a.id}/verify`} body={{ method: 'META_TAG' }} size="sm" successMessage="Check finished.">
                        Check meta tag
                      </ActionButton>
                    </div>
                  </div>
                  <div>
                    <b>Verification file</b>
                    <p className={m.muted} style={{ margin: '4px 0' }}>
                      Publish a text file at <code>{a.verification.file.path}</code> containing:
                    </p>
                    <code style={{ display: 'block', overflowWrap: 'anywhere', padding: 8, background: 'var(--surface-alt, #f7f9fc)', borderRadius: 8 }}>{a.verification.file.content}</code>
                    <div style={{ marginTop: 8 }}>
                      <ActionButton path={`/user/assets/${a.id}/verify`} body={{ method: 'HTML_FILE' }} size="sm" successMessage="Check finished.">
                        Check file
                      </ActionButton>
                    </div>
                  </div>
                  <div>
                    <b>Documents</b>
                    <p className={m.muted} style={{ margin: '4px 0' }}>
                      Cannot change DNS or the site? Upload a purchase agreement or registrar record for our team to review (PDF or image, up to 15 MB).
                    </p>
                    <UploadForm path={`/user/assets/${a.id}/evidence`} submitLabel="Upload document">
                      <FormGrid>
                        <Field label="File" htmlFor="ev-file">
                          <Input id="ev-file" name="file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" />
                        </Field>
                        <Field label="Note (optional)" htmlFor="ev-note">
                          <Input id="ev-note" name="note" maxLength={500} />
                        </Field>
                      </FormGrid>
                    </UploadForm>
                  </div>
                </div>
              )}
            </Panel>
          )}
          {prospective && (
            <Notice tone="amber" title="Prospective acquisition">
              This asset is not treated as owned. Change the relationship and verify ownership once the transfer is complete.
            </Notice>
          )}
          <Panel title="Verification history" bodyless>
            <DataTable columns={['Method', 'Result', 'Detail', 'When']} rows={a.evidence.map((e) => [verifyLabel(e.method), humanize(e.status), e.detail ?? e.filename ?? '—', formatDateTime(e.createdAt)])} empty="No checks yet." />
          </Panel>
          <Panel title="Financials" description="Monthly revenue and costs you report. They are labelled self-reported everywhere they appear.">
            <DataTable
              columns={['Month', 'Revenue', 'Costs', 'Profit', 'Source', '']}
              rows={a.financials.map((f) => [
                f.month.slice(0, 7),
                money(f.revenueMinor, a.currency),
                money(f.costMinor, a.currency),
                money(f.revenueMinor - f.costMinor, a.currency),
                humanize(f.source),
                <ActionButton key="d" method="DELETE" path={`/user/assets/${a.id}/financials/${f.id}`} size="sm" variant="ghost" confirm={`Delete ${f.month.slice(0, 7)}?`} successMessage="Entry deleted.">
                  Delete
                </ActionButton>,
              ])}
              empty="No financials recorded."
            />
            <div style={{ marginTop: 12 }}>
              <MinorForm path={`/user/assets/${a.id}/financials`} minorFields={['revenueMinor', 'costMinor']} submitLabel="Save month" successMessage="Month saved." resetOnSuccess>
                <FormGrid>
                  <Field label="Month" htmlFor="fin-month">
                    <Input id="fin-month" name="month" type="month" required />
                  </Field>
                  <Field label={`Revenue (${a.currency})`} htmlFor="fin-rev">
                    <Input id="fin-rev" name="revenueMinor" type="number" data-type="number" min={0} step="0.01" required />
                  </Field>
                  <Field label={`Costs (${a.currency})`} htmlFor="fin-cost">
                    <Input id="fin-cost" name="costMinor" type="number" data-type="number" min={0} step="0.01" required />
                  </Field>
                  <Field label="Note (optional)" htmlFor="fin-note">
                    <Input id="fin-note" name="note" maxLength={300} />
                  </Field>
                </FormGrid>
              </MinorForm>
            </div>
          </Panel>
          <Panel title="Edit asset">
            <AssetForm workspaceId={ctx.workspaceId ?? ''} projects={ctx.projects} asset={a} />
          </Panel>
        </div>
        <div className={m.stack}>
          <Panel title="Details">
            <KeyValue label="Website" value={a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.domain}</a> : '—'} />
            <KeyValue label="Category" value={a.category ?? '—'} />
            <KeyValue label="Acquired" value={formatDate(a.acquiredAt)} />
            <KeyValue label="Purchase price" value={money(a.purchasePriceMinor, a.currency)} />
            <KeyValue label="Linked project" value={a.project ? <Link href={`/app/projects/${a.project.id}`}>{a.project.name}</Link> : '—'} />
            {a.description && <p className={m.prose} style={{ marginTop: 10, fontSize: 14 }}>{a.description}</p>}
          </Panel>
          <Panel title="Valuations" actions={a.domain ? <Link href={`/website-value?domain=${encodeURIComponent(a.domain)}`}>Run valuation</Link> : undefined}>
            {a.valuations.length ? (
              <ul className={m.list}>
                {a.valuations.slice(0, 8).map((v, i) => (
                  <li key={v.id ?? i}>
                    {humanize(v.status)} · {range(v)} · quality {v.qualityScore ?? '—'} · {formatDate(v.completedAt ?? v.createdAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={m.muted} style={{ margin: 0 }}>No valuations for this domain yet.</p>
            )}
          </Panel>
          {a.project && (
            <Panel title="Improvement tasks" actions={<Link href="/app/optimize">Optimization Center</Link>}>
              {Object.keys(a.tasks).length ? (
                <ul className={m.list}>
                  {Object.entries(a.tasks).map(([k, v]) => (
                    <li key={k}>
                      {humanize(k)}: {v}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={m.muted} style={{ margin: 0 }}>No tasks yet. Run an audit on the linked project.</p>
              )}
            </Panel>
          )}
          <Panel title="Manage">
            <div className={m.actions}>
              {!a.archivedAt && (
                <ActionButton method="PATCH" path={`/user/assets/${a.id}`} body={{ archived: true }} variant="outline" size="sm" confirm="Archive this asset?" successMessage="Asset archived.">
                  Archive
                </ActionButton>
              )}
              <ActionButton method="DELETE" path={`/user/assets/${a.id}`} variant="ghost" size="sm" confirm="Delete this asset, its financials and verification history permanently?" redirectTo="/app/assets/portfolio" successMessage="Asset deleted.">
                Delete
              </ActionButton>
              <ButtonLink href="/seller/listings/new" variant="ghost" size="sm">
                Sell on the Marketplace
              </ButtonLink>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
