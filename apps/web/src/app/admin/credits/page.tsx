import { CheckCircle2, Clock3, Coins, FileSearch, MinusCircle, PlusCircle, RotateCcw } from 'lucide-react';
import { Field, Input, Panel, Select, Textarea } from '@/components/ui';
import { ActionButton, ApiForm } from '@/components/ui/actions';
import { AdminList, StatusPill } from '@/components/admin/AdminList';
import { adminGet, matchesQ, userLabel, type AdminWorkspace } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { getAppContext } from '@/lib/project';

export const metadata = { title: 'Credits & Adjustments' };

type Adjustment = {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'PROMOTIONAL_CREDIT' | 'CORRECTION';
  amount: string;
  reasonCode: string;
  internalNote: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'REVERSED';
  reversesAdjustmentId: string | null;
  balanceBefore: string | null;
  balanceAfter: string | null;
  createdAt: string;
  approvedAt: string | null;
  workspace: { id: string; name: string };
  requester: { id: string; email: string; displayName: string | null };
  approver: { id: string; email: string; displayName: string | null } | null;
};

const TONE = { PENDING_REVIEW: 'amber', APPROVED: 'blue', APPLIED: 'green', REJECTED: 'red', REVERSED: 'slate' } as const;
const TYPE = { CREDIT: 'Add credits', DEBIT: 'Remove credits', PROMOTIONAL_CREDIT: 'Promotional credit', CORRECTION: 'Correction' };
const TABS: Record<string, (a: Adjustment) => boolean> = {
  all: () => true,
  pending: (a) => a.status === 'PENDING_REVIEW',
  added: (a) => Number(a.amount) > 0 && a.status === 'APPLIED',
  removed: (a) => Number(a.amount) < 0 && a.status === 'APPLIED',
  reversed: (a) => a.status === 'REVERSED' || !!a.reversesAdjustmentId,
};

/**
 * Credits & Adjustments (chat design 2026-10-06). `credit_adjustments` +
 * append-only `credit_ledger`. Every adjustment needs a reason, is reviewed
 * by a second administrator before it touches the balance, and is never
 * edited: a reversal is a new opposite adjustment with the same review.
 */
export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = 'all', q } = await searchParams;
  const [adjustments, workspaces, { me }] = await Promise.all([adminGet<Adjustment[]>('/admin/credit-adjustments'), adminGet<AdminWorkspace[]>('/admin/workspaces'), getAppContext()]);
  const list = adjustments ?? [];
  const sum = (f: (a: Adjustment) => boolean) => (adjustments ? list.filter(f).reduce((n, a) => n + Math.abs(Number(a.amount)), 0).toLocaleString('en-US') : undefined);
  const rows = list.filter((a) => (TABS[tab] ?? TABS.all)(a) && matchesQ(q, a.workspace.name, a.reasonCode, a.internalNote, a.requester.email));

  return (
    <AdminList
      section="Billing & Access"
      title="Credits & Adjustments"
      description="Manage manual credit adjustments and view the complete history."
      metrics={[
        { label: 'Total Credit Adjustments', icon: <Coins size={24} />, tone: 'blue', value: adjustments ? list.length : undefined },
        { label: 'Credits Added', icon: <PlusCircle size={24} />, tone: 'green', value: sum(TABS.added) },
        { label: 'Credits Removed', icon: <MinusCircle size={24} />, tone: 'red', value: sum(TABS.removed) },
        { label: 'Pending Review', icon: <Clock3 size={24} />, tone: 'amber', value: adjustments ? list.filter(TABS.pending).length : undefined },
        { label: 'Reversed', icon: <RotateCcw size={24} />, tone: 'purple', value: adjustments ? list.filter((a) => a.status === 'REVERSED').length : undefined },
      ]}
      tabs={[
        { key: 'all', label: 'All Adjustments' },
        { key: 'pending', label: 'Pending Review' },
        { key: 'added', label: 'Credits Added' },
        { key: 'removed', label: 'Credits Removed' },
        { key: 'reversed', label: 'Reversals' },
      ]}
      activeTab={tab}
      basePath="/admin/credits"
      search="Search by workspace, reason or requester..."
      liveFilters={{ q }}
      columns={['Workspace', 'Type', 'Credits', 'Reason', 'Status', 'Requested / Reviewed', 'Actions']}
      rows={rows.map((a) => {
        const amount = Number(a.amount);
        const own = me?.id === a.requester.id;
        return [
          <b key="w">{a.workspace.name}</b>,
          a.reversesAdjustmentId ? 'Reversal' : TYPE[a.type],
          <span key="c" style={{ color: amount < 0 ? '#b91c1c' : 'var(--green)', fontWeight: 700 }}>
            {amount > 0 ? '+' : ''}
            {amount.toLocaleString('en-US')}
          </span>,
          <span key="r" style={{ display: 'block', maxWidth: 320 }}>
            <b>{a.reasonCode}</b>
            <small style={{ display: 'block', color: 'var(--muted)' }}>{a.internalNote}</small>
            {a.balanceBefore !== null && a.balanceAfter !== null && (
              <small style={{ display: 'block', color: 'var(--muted)' }}>
                Balance {Number(a.balanceBefore).toLocaleString('en-US')} → {Number(a.balanceAfter).toLocaleString('en-US')}
              </small>
            )}
          </span>,
          <StatusPill key="s" tone={TONE[a.status]}>
            {a.status === 'PENDING_REVIEW' ? 'Pending review' : a.status.charAt(0) + a.status.slice(1).toLowerCase()}
          </StatusPill>,
          <small key="by">
            {userLabel(a.requester)} · {formatDateTime(a.createdAt)}
            {a.approver && (
              <>
                <br />
                Reviewed by {userLabel(a.approver)}
              </>
            )}
          </small>,
          <span key="a" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {a.status === 'PENDING_REVIEW' &&
              (own ? (
                <small style={{ color: 'var(--muted)' }}>Awaiting another admin</small>
              ) : (
                <>
                  <ActionButton size="sm" path={`/admin/credit-adjustments/${a.id}/review`} body={{ approve: true }} confirm={`Apply ${amount > 0 ? '+' : ''}${amount} credits to ${a.workspace.name}?`}>
                    Approve
                  </ActionButton>
                  <ActionButton size="sm" variant="ghost" path={`/admin/credit-adjustments/${a.id}/review`} body={{ approve: false }}>
                    Reject
                  </ActionButton>
                </>
              ))}
            {a.status === 'APPLIED' && !a.reversesAdjustmentId && (
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--blue)', fontSize: 13 }}>Reverse</summary>
                <ApiForm path={`/admin/credit-adjustments/${a.id}/reverse`} submitLabel="Request Reversal" successMessage="Reversal requested for review.">
                  <Input name="note" required minLength={3} maxLength={2000} placeholder="Why is this being reversed?" aria-label="Reversal note" />
                </ApiForm>
              </details>
            )}
          </span>,
        ];
      })}
      empty={{ icon: <FileSearch size={40} />, title: adjustments ? 'No credit adjustments yet' : 'Adjustments unavailable', text: adjustments ? 'When credits are manually added or removed from a workspace, they will appear here.' : 'Your account cannot read billing data, or the API is unavailable.' }}
      footnote="All credit adjustments require a reason, are reviewed by a second administrator and are recorded in the audit log. Adjustments cannot be edited or deleted; a reversal is a new opposite adjustment."
    >
      <Panel title="Request an Adjustment" description="Goes to Pending Review; another administrator applies it.">
        {workspaces?.length ? (
          <ApiForm path="/admin/credit-adjustments" submitLabel="Submit for Review" resetOnSuccess successMessage="Adjustment submitted for review.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Workspace" htmlFor="ca-ws">
                <Select id="ca-ws" name="workspaceId" required>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({Number(w.creditWallet?.balanceCache ?? 0).toLocaleString('en-US')} credits)
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type" htmlFor="ca-type">
                <Select id="ca-type" name="type" defaultValue="CREDIT">
                  <option value="CREDIT">Add credits</option>
                  <option value="DEBIT">Remove credits</option>
                  <option value="PROMOTIONAL_CREDIT">Promotional credit</option>
                  <option value="CORRECTION">Correction (signed)</option>
                </Select>
              </Field>
              <Field label="Credits" htmlFor="ca-amt" hint="Corrections may be negative.">
                <Input id="ca-amt" name="amount" type="number" data-type="number" step="any" required />
              </Field>
              <Field label="Reason code" htmlFor="ca-code">
                <Input id="ca-code" name="reasonCode" required minLength={2} maxLength={60} placeholder="e.g. SERVICE_CREDIT" />
              </Field>
            </div>
            <Field label="Internal note" htmlFor="ca-note">
              <Textarea id="ca-note" name="internalNote" rows={2} required minLength={3} maxLength={2000} placeholder="Context for the reviewer and the audit log (ticket, approval, etc.)" />
            </Field>
          </ApiForm>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            <CheckCircle2 size={14} /> No workspaces to adjust yet.
          </p>
        )}
      </Panel>
    </AdminList>
  );
}
