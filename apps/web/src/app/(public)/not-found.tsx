import { ButtonLink } from '@/components/ui';
import s from '@/components/public/public.module.css';

export default function NotFound() {
  return (
    <section className={s.hero} style={{ padding: '96px 24px' }}>
      <div className={s.eyebrow}>404</div>
      <h1>We couldn’t find that page</h1>
      <p>The page may have moved, or it may not be published yet.</p>
      <div className={s.heroActions}>
        <ButtonLink href="/" variant="green">
          Go to homepage
        </ButtonLink>
        <ButtonLink href="/help" variant="greenOutline">
          Visit Help Center
        </ButtonLink>
      </div>
    </section>
  );
}
