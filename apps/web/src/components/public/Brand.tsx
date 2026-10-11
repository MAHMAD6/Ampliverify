import Image from 'next/image';
import Link from 'next/link';
import s from './site.module.css';

/** Public-site lockup: approved mark + AmpliVerify wordmark (Verify in green) + tagline. */
export function Brand({ href = '/', tagline = 'AUDIT · OPTIMIZE · VERIFY', dark = false }: { href?: string; tagline?: string; dark?: boolean }) {
  return (
    <Link href={href} className={`${s.brand} ${dark ? s.brandDark : ''}`} aria-label="AmpliVerify home">
      <Image src="/brand/mark-transparent.png" alt="" width={46} height={46} priority />
      <span>
        <b>
          Ampli<span className={s.brandAccent}>Verify</span>
        </b>
        <small>{tagline}</small>
      </span>
    </Link>
  );
}
