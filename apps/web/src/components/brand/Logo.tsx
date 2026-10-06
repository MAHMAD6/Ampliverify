import Image from 'next/image';
import Link from 'next/link';
import s from './logo.module.css';

/**
 * Brand lockup: the green "A" mark with the Ampli/Verify wordmark.
 * `onDark` for navy sidebars, `tagline` picks the approved line for the context.
 */
export function Logo({
  href = '/',
  onDark = false,
  tagline = 'workflow',
  size = 40,
}: {
  href?: string;
  onDark?: boolean;
  tagline?: 'workflow' | 'engineering' | 'none';
  size?: number;
}) {
  return (
    <Link href={href} className={s.logo} aria-label="AmpliVerify home">
      <Image src="/brand/mark-transparent.png" alt="" width={size} height={size} priority />
      <span className={s.text}>
        <span className={s.word} style={{ fontSize: size * 0.55 }}>
          <span className={onDark ? s.ampliDark : s.ampli}>Ampli</span>
          <span className={s.verify}>Verify</span>
        </span>
        {tagline !== 'none' && (
          <span className={onDark ? s.tagDark : s.tag}>
            {tagline === 'workflow' ? 'AUDIT · OPTIMIZE · VERIFY' : 'SEO ENGINEERING'}
          </span>
        )}
      </span>
    </Link>
  );
}
