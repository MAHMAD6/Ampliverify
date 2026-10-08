import { UserDetail } from '@/components/admin/UserDetail';

export const metadata = { title: 'Admin / Sub-Admin Detail' };

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetail id={id} parent={{ label: 'Admins', href: '/admin/admins' }} />;
}
