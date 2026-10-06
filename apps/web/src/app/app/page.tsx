import { redirect } from 'next/navigation';

/** The app home is the Dashboard (`/dashboard` in the navigation page map). */
export default function AppIndex() {
  redirect('/app/dashboard');
}
