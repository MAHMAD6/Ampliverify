import { UserDetail } from '@/components/admin/UserDetail';

export const metadata = { title: 'User Detail' };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetail id={id} parent={{ label: 'All Users', href: '/admin/users' }} />;
}
