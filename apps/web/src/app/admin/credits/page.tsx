import { Plus, Search, Wallet } from 'lucide-react';
import { AdminHeader, Guidelines, ListPanel, MetricRow } from '@/components/admin/AdminParts';
import { Button, Field, Grid, Input, Notice, Panel, Select, Textarea } from '@/components/ui';

export const metadata = { title: 'Credits & Adjustments' };

/**
 * Adjustments go through credit_adjustments (reason code, note, second
 * approver) before a ledger entry is written. The admin API for this flow is
 * not built yet, so the form cannot be submitted.
 */
export default function CreditsPage() {
  return (
    <>
      <AdminHeader
        section="Billing & Access"
        title="Credits & Adjustments"
        description="Create and audit controlled account credits, debits, and billing corrections."
        actions={
          <Button icon={<Plus size={16} />} disabled>
            New Adjustment
          </Button>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="amber" title="Financial control:">
          Credits and adjustments change customer balances. They require a reason code, an internal note, a second approver above the configured threshold, and leave a permanent audit trail.
        </Notice>
      </div>
      <MetricRow
        items={[
          { label: 'Available Credits', note: 'No credit data loaded' },
          { label: 'Adjustments This Period', note: 'No adjustments recorded' },
          { label: 'Pending Review', note: 'No pending items' },
          { label: 'Reversed', note: 'No reversals recorded' },
        ]}
      />
      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Panel title="Create Adjustment" description="Apply an approved account credit or correction." flushHead>
          <Field label="Account / organization" htmlFor="cr-account">
            <Input id="cr-account" icon={<Search size={16} />} placeholder="Search account" disabled />
          </Field>
          <Grid cols={2}>
            <Field label="Adjustment type" htmlFor="cr-type">
              <Select id="cr-type" defaultValue="" disabled>
                <option value="">Select type</option>
                <option>Credit</option>
                <option>Debit</option>
                <option>Promotional credit</option>
                <option>Correction</option>
              </Select>
            </Field>
            <Field label="Amount" htmlFor="cr-amount">
              <Input id="cr-amount" type="number" placeholder="Enter approved amount" disabled />
            </Field>
          </Grid>
          <Field label="Reason code" htmlFor="cr-reason">
            <Select id="cr-reason" defaultValue="" disabled>
              <option value="">Select reason</option>
            </Select>
          </Field>
          <Field label="Internal note" htmlFor="cr-note">
            <Textarea id="cr-note" placeholder="Document the approved business reason." disabled style={{ minHeight: 80 }} />
          </Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" disabled>
              Cancel
            </Button>
            <Button disabled>Review Adjustment</Button>
          </div>
        </Panel>
        <Guidelines
          title="Adjustment Guardrails"
          description="Prevent untraceable or accidental balance changes."
          items={[
            'Require a reason code and internal note.',
            'Require secondary approval above configured thresholds — nobody approves their own adjustment.',
            'Record before/after balance, administrator, and timestamp.',
            'Use reversals instead of deleting completed adjustments.',
            'Keep promotional credits separate from cash refunds.',
          ]}
        />
      </Grid>
      <ListPanel
        title="Adjustment History"
        description="Credits, debits, reversals, and account corrections."
        search="Search account, administrator, or reference..."
        selects={['All adjustment types', 'All statuses', 'Date range']}
        columns={['Account', 'Type', 'Amount', 'Reason', 'Status', 'Requested by', 'Date']}
        emptyIcon={<Wallet size={26} />}
        emptyTitle="No adjustments recorded"
        emptyText="Completed adjustments will appear here with audit details."
      />
    </>
  );
}
