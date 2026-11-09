import { ShieldCheck } from 'lucide-react';
import { KeyValue, PageHeader, Panel } from '@/components/ui';
import { ActionButton } from '@/components/ui/actions';
import { NoteAction } from '@/components/market/forms';
import { StateView } from '@/components/ui/StateView';
import { AdminMarketNav } from '@/components/admin/market/AdminMarketNav';
import { Pills, StatusBadge } from '@/components/market/parts';
import { adminGet } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { CHECK_KIND, CHECK_STATUS } from '@/lib/marketplace';

export const metadata = { title: 'Seller Verification · Admin' };

type Check = { id: string; kind: string; status: string; seller: { id: string; displayName: string; email: string }; listing: { id: string; title: string; url: string | null } | null; details: Record<string, unknown> | null; files: { index: number; filename: string; contentType: string }[]; decisionNote: string | null; createdAt: string; reviewedAt: string | null };
const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

/** Identity, business, ownership, traffic, financial and AI checks are each decided on their own. */
export default async function AdminVerification({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status ?? '') ? sp.status! : 'PENDING';
  const rows = await adminGet<Check[]>(`/admin/marketplace/verifications${status === 'ALL' ? '' : `?status=${status}`}`);
  return (
    <>
      <PageHeader title="Seller Verification" description="Review evidence and decide each check. Opening a document is recorded in the audit log." />
      <AdminMarketNav active="verification" />
      <Pills items={FILTERS.map((f) => ({ key: f, label: f === 'ALL' ? 'All' : (CHECK_STATUS[f]?.label ?? f), href: `/admin/marketplace/verification?status=${f}` }))} active={status} label="Status" />
      <div style={{ marginTop: 14 }}>
        {!rows ? (
          <Panel>
            <StateView kind="error" title="Verification checks could not be loaded with your permissions." />
          </Panel>
        ) : rows.length === 0 ? (
          <Panel>
            <StateView kind="empty" icon={<ShieldCheck size={36} />} title="Nothing here" description={status === 'PENDING' ? 'No checks are waiting for review.' : 'No checks with this status.'} />
          </Panel>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {rows.map((c) => (
              <Panel key={c.id} title={`${CHECK_KIND[c.kind] ?? c.kind} check · ${c.seller.displayName}`} description={`${c.seller.email} · submitted ${formatDateTime(c.createdAt)}`} actions={<StatusBadge map={CHECK_STATUS} value={c.status} />}>
                {c.listing && <KeyValue label="Listing" value={`${c.listing.title}${c.listing.url ? ` (${c.listing.url})` : ''}`} />}
                {c.details &&
                  Object.entries(c.details).map(([k, v]) => (
                    <KeyValue key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase())} value={typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)} />
                  ))}
                <div style={{ marginTop: 8 }}>
                  <b style={{ fontSize: 14 }}>Evidence</b>
                  {c.files.length ? (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {c.files.map((f) => (
                        <li key={f.index}>
                          <a href={`/api/files/admin/marketplace/verifications/${c.id}/files/${f.index}`} target="_blank" rel="noreferrer">
                            {f.filename}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>No files were uploaded.</p>
                  )}
                </div>
                {c.decisionNote && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>Decision note: {c.decisionNote}</p>}
                {c.status === 'PENDING' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginTop: 12 }}>
                    <ActionButton path={`/admin/marketplace/verifications/${c.id}/decision`} body={{ decision: 'APPROVE' }} confirm="Approve this check?" successMessage="Check approved.">
                      Approve
                    </ActionButton>
                    <NoteAction path={`/admin/marketplace/verifications/${c.id}/decision`} body={{ decision: 'REJECT' }} label="Reject" placeholder="Reason (shown to the seller)" required variant="outline" successMessage="Check rejected; the seller was notified." />
                  </div>
                )}
              </Panel>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
