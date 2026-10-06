import { UserCog } from 'lucide-react';
import { AdminRoster } from '@/components/admin/AdminRoster';
import { SUB_ADMIN_ROLE_KEYS } from '@/lib/admin-data';

export const metadata = { title: 'Sub-Admins' };

export default async function SubAdminsPage({ searchParams }: { searchParams: Promise<{ q?: string; scope?: string; status?: string }> }) {
  return <AdminRoster kind="Sub-Admin" roleKeys={SUB_ADMIN_ROLE_KEYS} {...await searchParams} emptyIcon={<UserCog size={40} />} />;
}
