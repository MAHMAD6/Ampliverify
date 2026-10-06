import { redirect } from 'next/navigation';

/** Content Strategy opens on its first tab, Opportunities (Topic Ideas). */
export default function ContentIndex() {
  redirect('/app/content/ideas');
}
