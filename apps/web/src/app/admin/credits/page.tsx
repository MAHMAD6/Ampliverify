import { Clock3, Coins, FileSearch, MinusCircle, PlusCircle, RotateCcw } from 'lucide-react';
import { AdminList } from '@/components/admin/AdminList';
import { AddMenu } from '@/components/admin/AddMenu';

export const metadata = { title: 'Credits & Adjustments' };

/**
 * Credits & Adjustments (chat design 2026-10-06). `credit_adjustments` +
 * append-only `credit_ledger`. Adjustments require a reason, are audited, and
 * are never edited: a reversal is a new opposite adjustment.
 */
export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams;
  const menu = (
    <AddMenu
      label="Create Adjustment"
      items={[
        { title: 'Add Credits', text: 'Increase user credits', icon: <PlusCircle size={20} />, disabledReason: 'Needs the credit adjustment API.' },
        { title: 'Remove Credits', text: 'Decrease user credits', icon: <MinusCircle size={20} />, disabledReason: 'Needs the credit adjustment API.' },
      ]}
    />
  );
  return (
    <AdminList
      section="Billing & Access"
      title="Credits & Adjustments"
      description="Manage manual credit adjustments and view the complete history."
      actions={menu}
      metrics={[
        { label: 'Total Credit Adjustments', icon: <Coins size={24} />, tone: 'blue' },
        { label: 'Credits Added', icon: <PlusCircle size={24} />, tone: 'green' },
        { label: 'Credits Removed', icon: <MinusCircle size={24} />, tone: 'red' },
        { label: 'Pending', icon: <Clock3 size={24} />, tone: 'amber' },
        { label: 'Reversed', icon: <RotateCcw size={24} />, tone: 'purple' },
      ]}
      tabs={[
        { key: 'all', label: 'All Adjustments' },
        { key: 'added', label: 'Credits Added' },
        { key: 'removed', label: 'Credits Removed' },
        { key: 'pending', label: 'Pending' },
        { key: 'reversed', label: 'Reversed' },
      ]}
      activeTab={tab}
      basePath="/admin/credits"
      search="Search by user, account, or email..."
      selects={[
        { label: 'Adjustment Type', options: ['All Types'] },
        { label: 'Status', options: ['All Statuses'] },
        { label: 'Date Range', options: ['Select date range'] },
      ]}
      columns={['User / Account', 'Adjustment Type', 'Credits', 'Reason', 'Status', 'Created By', 'Date', 'Actions']}
      empty={{ icon: <FileSearch size={40} />, title: 'No credit adjustments yet', text: 'When credits are manually added or removed from a user account, they will appear here.' }}
      footnote="All credit adjustments require a reason and are recorded in the audit log. Adjustments cannot be edited or deleted. To reverse an adjustment, create a new adjustment with the opposite action."
    />
  );
}
