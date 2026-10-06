import { notFound } from 'next/navigation';
import { AdminDetail } from '@/components/admin/AdminDetail';
import { apiGet } from '@/lib/api';
import { loadAssignments, type AdminUser } from '@/lib/admin-data';
import { loadAudit } from '@/lib/audit';

export const metadata = { title: 'Admin / Sub-Admin Detail' };

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, assignments, audit] = await Promise.all([apiGet<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, { auth: true }), loadAssignments(), loadAudit()]);
  if (!user.ok && user.reason === 'not_found') notFound();
  return <AdminDetail user={user.ok ? user.data : null} assignments={(assignments ?? []).filter((a) => a.user.id === id)} activity={audit.records.filter((r) => r.actorUserId === id)} />;
}
