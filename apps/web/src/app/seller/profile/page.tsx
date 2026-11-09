import Link from 'next/link';
import { PageHeader, Panel } from '@/components/ui';
import { LoadError } from '@/components/market/parts';
import { SellerGate } from '@/components/market/SellerGate';
import { SellerProfileForm } from '@/components/market/SellerProfileForm';
import { apiGet } from '@/lib/api';
import type { SellerProfile } from '@/lib/marketplace';

export const metadata = { title: 'Seller Profile · Marketplace' };

export default async function SellerProfilePage() {
  const res = await apiGet<SellerProfile | null>('/user/marketplace/seller', { auth: true });
  if (!res.ok) return <LoadError what="Your seller profile" />;
  if (!res.data) return <SellerGate />;
  return (
    <>
      <PageHeader title="Seller Profile" description="How buyers see you on your listings and public seller page." actions={<Link href={`/marketplace/sellers/${res.data.id}`}>View public page</Link>} />
      <Panel>
        <SellerProfileForm p={res.data} />
      </Panel>
    </>
  );
}
