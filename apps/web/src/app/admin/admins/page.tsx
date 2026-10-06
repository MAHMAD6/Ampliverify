import { ShieldCheck } from 'lucide-react';
import { AdminRoster } from '@/components/admin/AdminRoster';
import { ADMIN_ROLE_KEYS } from '@/lib/admin-data';

export const metadata = { title: 'Admins' };

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ q?: string; scope?: string; status?: string }> }) {
  return <AdminRoster kind="Admin" roleKeys={ADMIN_ROLE_KEYS} {...await searchParams} emptyIcon={<ShieldCheck size={40} />} />;
}
