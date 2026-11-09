import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import { ButtonLink, DataTable, Field, Input, KeyValue, Notice, PageHeader, Panel, Select, Textarea } from '@/components/ui';
import { AutoRefresh } from '@/components/ui/actions';
import { MinorForm } from '@/components/market/forms';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { apiGet } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { CASE_STATUS, fileSize, money, type OrderDetail, ORDER_STATUS } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Purchase · Marketplace' };

/** Receipt, files and issue / refund requests. Files unlock only after the provider confirms payment. */
export default async function PurchasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<OrderDetail>(`/user/marketplace/orders/${id}`, { auth: true });
  if (!res.ok) return res.reason === 'not_found' ? notFound() : <LoadError what="This purchase" />;
  const o = res.data;
  const pending = o.status === 'PENDING_PAYMENT';
  const paid = o.status === 'PAID' || o.status === 'PARTIALLY_REFUNDED';
  const openCase = o.cases.find((c) => c.status === 'OPEN' || c.status === 'UNDER_REVIEW');
  return (
    <>
      <AutoRefresh active={pending} seconds={4} />
      <PageHeader title={o.listing.title} description={`Order ${o.id.slice(0, 8)} · ${formatDateTime(o.createdAt)}`} crumbs={[{ label: 'My Purchases', href: '/buyer/purchases' }, { label: o.listing.title }]} actions={<StatusBadge map={ORDER_STATUS} value={o.status} />} />
      {pending && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="blue" title={sp.checkout === 'returned' ? 'Confirming your payment…' : 'Waiting for payment.'}>
            Your files unlock as soon as the payment provider confirms the payment. This page updates automatically.
          </Notice>
        </div>
      )}
      {(o.status === 'FAILED' || o.status === 'CANCELED') && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="amber" title="This payment did not complete.">
            No money was taken for this order. You can try again from the listing.
          </Notice>
        </div>
      )}
      <div className={m.two}>
        <div className={m.stack}>
          <Panel title="Files" description="Downloads are short-lived links checked against your order each time.">
            <DataTable
              columns={['File', 'Size', 'Access', '']}
              rows={o.downloads.map((d) => [
                d.filename,
                fileSize(d.sizeBytes),
                d.status === 'ACTIVE' && paid ? 'Available' : d.status === 'REVOKED' ? 'Access ended (refunded)' : 'Unavailable',
                d.status === 'ACTIVE' && paid ? (
                  <ButtonLink key="d" href={`/api/files/user/marketplace/downloads/${d.id}/file`} size="sm" variant="outline" icon={<Download size={14} />}>
                    Download
                  </ButtonLink>
                ) : (
                  ''
                ),
              ])}
              empty={pending ? 'Files appear once payment is confirmed.' : 'No files for this order.'}
            />
          </Panel>
          <Panel title="Licence you accepted">
            <p className={m.prose}>{o.licenseTerms ?? '—'}</p>
            <p className={m.muted} style={{ marginTop: 8 }}>
              Accepted {formatDateTime(o.licenseAcceptedAt)}
              {o.withdrawalConsentAt ? ` · immediate access requested ${formatDateTime(o.withdrawalConsentAt)}` : ''}
            </p>
          </Panel>
          {paid && (
            <Panel title="Report an issue or request a refund">
              {o.reportingGuidelineUntil && (
                <p className={m.muted} style={{ marginTop: 0 }}>
                  Please report problems by {formatDate(o.reportingGuidelineUntil)} so we can help quickly. This is a guideline, not a deadline: your statutory rights are unaffected.
                </p>
              )}
              {openCase ? (
                <Notice tone="neutral" title="You have an open request for this purchase.">
                  We will update you here and by notification.
                </Notice>
              ) : (
                <MinorForm path="/user/marketplace/cases" extra={{ orderId: o.id }} minorFields={['amountMinor']} dropEmpty={['amountMinor']} submitLabel="Send request" successMessage="Request sent. Our team will review it." resetOnSuccess>
                  <Field label="Request" htmlFor="case-kind">
                    <Select id="case-kind" name="kind" defaultValue="REFUND">
                      <option value="REFUND">Request a refund</option>
                      <option value="ISSUE">Report an issue</option>
                    </Select>
                  </Field>
                  <Field label="Reason" htmlFor="case-reason">
                    <Input id="case-reason" name="reason" required minLength={3} maxLength={200} placeholder="File is corrupted, not as described…" />
                  </Field>
                  <Field label="Details" htmlFor="case-details" hint="At least 20 characters.">
                    <Textarea id="case-details" name="details" required minLength={20} maxLength={5000} rows={4} />
                  </Field>
                  <Field label={`Refund amount (${o.currency}, optional)`} htmlFor="case-amt" hint="Leave empty for the full remaining amount.">
                    <Input id="case-amt" name="amountMinor" data-type="number" type="number" min={0.01} step="0.01" />
                  </Field>
                </MinorForm>
              )}
            </Panel>
          )}
        </div>
        <div className={m.stack}>
          <Panel title="Receipt">
            <KeyValue label="Item" value={o.listing.title} />
            <KeyValue label="Amount" value={money(o.amountMinor, o.currency)} />
            {o.refundedMinor > 0 && <KeyValue label="Refunded" value={money(o.refundedMinor, o.currency)} />}
            <KeyValue label="Paid" value={formatDateTime(o.paidAt)} />
            <KeyValue label="Order ID" value={<code>{o.id}</code>} />
          </Panel>
          {o.cases.length > 0 && (
            <Panel title="Requests">
              <ul className={m.list}>
                {o.cases.map((c) => (
                  <li key={c.id}>
                    {c.kind === 'REFUND' ? 'Refund' : c.kind === 'DISPUTE' ? 'Card dispute' : 'Issue'}: {c.reason} · <StatusBadge map={CASE_STATUS} value={c.status} />
                    {c.decisionNote && <div className={m.muted}>{c.decisionNote}</div>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
