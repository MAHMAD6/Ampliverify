import { CircleCheck, Landmark, ShieldCheck } from 'lucide-react';
import { DataTable, Field, FormGrid, Input, Notice, PageHeader, Panel, Select } from '@/components/ui';
import { ActionButton, RedirectButton, UploadForm } from '@/components/ui/actions';
import { LoadError, StatusBadge } from '@/components/market/parts';
import { SellerGate } from '@/components/market/SellerGate';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { CHECK_KIND, CHECK_STATUS, type MarketMeta, type SellerProfile } from '@/lib/marketplace';
import m from '@/components/market/market.module.css';

export const metadata = { title: 'Verification · Marketplace' };

/** Identity, business and payout checks, each decided separately by staff (V2 guide §1.2). Evidence files stay private. */
export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ payout?: string }> }) {
  const [res, meta, sp] = await Promise.all([apiGet<SellerProfile | null>('/user/marketplace/seller', { auth: true }), apiGet<MarketMeta>('/public/marketplace/meta', { revalidate: 60 }), searchParams]);
  if (!res.ok) return <LoadError what="Verification" />;
  const p = res.data;
  if (!p) return <SellerGate />;
  const canSubmit = (s: string) => s === 'NOT_STARTED' || s === 'REJECTED';
  const lastNote = (kind: string) => p.verifications.find((v) => v.kind === kind && v.status === 'REJECTED')?.decisionNote;
  const paymentsReady = meta.ok && meta.data.terms.paymentsConfigured;
  return (
    <>
      <PageHeader title="Seller Verification" description="Each check is reviewed on its own by our team. Approved checks are shown separately to buyers; nothing is approved automatically." />
      {sp.payout === 'returned' && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="blue" title="Welcome back.">
            If you finished the payout setup, refresh the status below. It can take a few minutes for the provider to confirm.
          </Notice>
        </div>
      )}
      <div className={m.stack}>
        <Panel title="Identity verification" description="Required before your listings can be published." actions={<StatusBadge map={CHECK_STATUS} value={p.checks.identity} />}>
          {lastNote('IDENTITY') && p.checks.identity === 'REJECTED' && (
            <Notice tone="amber" title="Not approved">
              {lastNote('IDENTITY')}
            </Notice>
          )}
          {canSubmit(p.checks.identity) ? (
            <UploadForm path="/user/marketplace/seller/verifications/identity" submitLabel="Submit identity check">
              <FormGrid>
                <Field label="Full legal name" htmlFor="id-name">
                  <Input id="id-name" name="legalName" required maxLength={120} />
                </Field>
                <Field label="Country of residence" htmlFor="id-country">
                  <Input id="id-country" name="country" required maxLength={60} />
                </Field>
                <Field label="Document type" htmlFor="id-doc">
                  <Select id="id-doc" name="documentType" defaultValue="passport">
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID card</option>
                    <option value="driving_licence">Driving licence</option>
                  </Select>
                </Field>
              </FormGrid>
              <Field label="Document images or PDF" htmlFor="id-files" hint="Up to 5 files, 15 MB each: PDF, PNG, JPEG or WebP. Only our verification team can open them.">
                <input id="id-files" name="files" type="file" multiple required accept="application/pdf,image/png,image/jpeg,image/webp" />
              </Field>
            </UploadForm>
          ) : (
            <p className={m.muted} style={{ margin: 0 }}>
              {p.checks.identity === 'PENDING' ? 'Submitted. We will notify you when it is reviewed.' : <><CircleCheck size={14} aria-hidden /> Your identity is verified.</>}
            </p>
          )}
        </Panel>
        <Panel title="Business verification (optional)" description="For sellers listing as a company. Shown to buyers as a separate check." actions={<StatusBadge map={CHECK_STATUS} value={p.checks.business} />}>
          {lastNote('BUSINESS') && p.checks.business === 'REJECTED' && (
            <Notice tone="amber" title="Not approved">
              {lastNote('BUSINESS')}
            </Notice>
          )}
          {canSubmit(p.checks.business) ? (
            <UploadForm path="/user/marketplace/seller/verifications/business" submitLabel="Submit business check">
              <FormGrid>
                <Field label="Registered business name" htmlFor="bz-name">
                  <Input id="bz-name" name="businessName" required maxLength={160} />
                </Field>
                <Field label="Registration number" htmlFor="bz-reg">
                  <Input id="bz-reg" name="registrationNumber" maxLength={80} />
                </Field>
                <Field label="Country of registration" htmlFor="bz-country">
                  <Input id="bz-country" name="country" required maxLength={60} />
                </Field>
              </FormGrid>
              <Field label="Registration documents (optional)" htmlFor="bz-files" hint="Certificate of incorporation or registry extract. PDF or image, up to 5 files.">
                <input id="bz-files" name="files" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" />
              </Field>
            </UploadForm>
          ) : (
            <p className={m.muted} style={{ margin: 0 }}>{p.checks.business === 'PENDING' ? 'Submitted. We will notify you when it is reviewed.' : 'Your business is verified.'}</p>
          )}
        </Panel>
        <Panel title="Payout account" description="Payouts are sent through Stripe Connect. Your bank details are entered with Stripe, never on AmpliVerify." actions={<StatusBadge map={CHECK_STATUS} value={p.checks.payout} />}>
          {!paymentsReady ? (
            <p className={m.muted} style={{ margin: 0 }}>Payout accounts are not available yet.</p>
          ) : p.checks.identity !== 'APPROVED' ? (
            <p className={m.muted} style={{ margin: 0 }}>Available once your identity is verified.</p>
          ) : (
            <div className={m.actions}>
              {!p.payoutsEnabled && (
                <RedirectButton path="/user/marketplace/seller/payout-account" icon={<Landmark size={16} />}>
                  {p.payoutAccountConnected ? 'Continue payout setup' : 'Connect payout account'}
                </RedirectButton>
              )}
              {p.payoutAccountConnected && (
                <ActionButton path="/user/marketplace/seller/payout-account/refresh" variant="outline" successMessage="Status refreshed.">
                  Refresh status
                </ActionButton>
              )}
              {p.payoutsEnabled && (
                <span>
                  <ShieldCheck size={14} aria-hidden /> Payouts enabled.
                </span>
              )}
            </div>
          )}
        </Panel>
        <Panel title="Verification history" bodyless>
          <DataTable
            columns={['Check', 'Status', 'Files', 'Submitted', 'Reviewed', 'Note']}
            rows={p.verifications.map((v) => [CHECK_KIND[v.kind] ?? v.kind, <StatusBadge key="s" map={CHECK_STATUS} value={v.status} />, v.files.length, formatDateTime(v.createdAt), formatDateTime(v.reviewedAt), v.decisionNote ?? '—'])}
            empty="No checks submitted yet."
          />
        </Panel>
      </div>
    </>
  );
}
