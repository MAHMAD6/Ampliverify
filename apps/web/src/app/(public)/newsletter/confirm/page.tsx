import { NewsletterToken } from '@/components/public/NewsletterToken';
import s from '@/components/public/site.module.css';

export const metadata = { title: 'Confirm Subscription', robots: { index: false } };

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return (
    <section className={s.section}>
      <div className={s.container} style={{ maxWidth: 560 }}>
        <NewsletterToken action="confirm" token={token.slice(0, 100)} />
      </div>
    </section>
  );
}
