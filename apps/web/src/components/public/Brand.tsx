import Image from 'next/image';
import Link from 'next/link';
import s from './site.module.css';

/** Public-site lockup: approved mark + AMPLIVERIFY wordmark + tagline. */
export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className={s.brand} aria-label="AmpliVerify home">
      <Image src="/brand/mark-transparent.png" alt="" width={46} height={46} priority />
      <span>
        <b>AMPLIVERIFY</b>
        <small>AUDIT · OPTIMIZE · VERIFY</small>
      </span>
    </Link>
  );
}
