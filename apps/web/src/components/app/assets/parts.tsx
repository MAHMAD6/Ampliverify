import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { Badge, ButtonLink, Panel } from '@/components/ui';
import { StateView } from '@/components/ui/StateView';
import { OWNERSHIP, type OwnershipStatus, relationshipLabel } from '@/lib/assets';

export function OwnershipBadge({ status }: { status: OwnershipStatus }) {
  const s = OWNERSHIP[status] ?? { label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function RelationshipBadge({ r }: { r: string }) {
  return <Badge tone={r === 'PROSPECTIVE' ? 'amber' : 'blue'}>{relationshipLabel(r)}</Badge>;
}

export function NoWorkspace() {
  return (
    <Panel>
      <StateView kind="empty" icon={<Briefcase size={36} />} title="Finish setting up your account" description="Create your first project to start your digital asset portfolio." action={<ButtonLink href="/app/projects/new">Create project</ButtonLink>} />
    </Panel>
  );
}

export function AssetsError() {
  return (
    <Panel>
      <StateView kind="error" title="Digital assets could not be loaded" description="Please try again shortly." />
    </Panel>
  );
}

export function NoAssets({ title = 'No digital assets yet', description = 'Add the websites and online businesses you own, manage or are considering buying.' }: { title?: string; description?: string }) {
  return (
    <Panel>
      <StateView kind="empty" icon={<Briefcase size={40} />} title={title} description={description} action={<ButtonLink href="/app/assets/new">Add Digital Asset</ButtonLink>} />
    </Panel>
  );
}

export const assetLink = (a: { id: string; name: string }) => <Link href={`/app/assets/${a.id}`}>{a.name}</Link>;
