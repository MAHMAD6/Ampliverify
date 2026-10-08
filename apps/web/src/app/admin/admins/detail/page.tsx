import { redirect } from 'next/navigation';

/** Navigation entry for "Admin Detail": a person is opened from Admins, Sub-Admins or All Users. */
export default function AdminDetailTemplate() {
  redirect('/admin/admins');
}
