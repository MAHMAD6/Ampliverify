import { AdminDetail } from '@/components/admin/AdminDetail';

export const metadata = { title: 'Admin / Sub-Admin Detail' };

/** Template entry from the navigation; a specific person is opened from Admins, Sub-Admins or All Users. */
export default function AdminDetailTemplate() {
  return <AdminDetail user={null} assignments={[]} activity={[]} />;
}
