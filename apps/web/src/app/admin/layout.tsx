import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { apiGet } from '@/lib/api';
import type { Me } from '@/lib/types';

export const metadata: Metadata = { title: { default: 'Super Admin', template: '%s · Super Admin' }, robots: { index: false, follow: false } };

/**
 * Every admin read/write is authorized by the API (global permissions). The
 * shell itself carries no data, so it is safe to render before sign-in exists.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await apiGet<Me>('/user/me', { auth: true });
  return <AdminShell me={me.ok ? me.data : null}>{children}</AdminShell>;
}
