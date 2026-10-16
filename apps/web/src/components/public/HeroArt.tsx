import type { ReactNode } from 'react';
import s from './pages.module.css';

/** Inline illustrations for the Company / Resources / Legal heroes (Public_Frontend designs). Decorative only. */
const G = { dark: '#0e5e2b', mid: '#15803d', leaf: '#1e9c45', light: '#c9ecd4', pale: '#e7f6ec', white: '#ffffff', line: '#d9e4dc', navy: '#0b1b35' };

function Plant({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0 C-30 -20 -42 -62 -20 -92 C2 -62 6 -24 0 0Z" fill={G.leaf} />
      <path d="M2 0 C30 -14 52 -50 38 -84 C12 -64 0 -30 2 0Z" fill={G.mid} />
      <path d="M0 0 C-12 -30 -48 -40 -66 -30 C-50 -6 -22 4 0 0Z" fill="#2fb259" />
      <path d="M-34 0 H34 L28 56 Q0 66 -28 56Z" fill={G.white} stroke={G.line} strokeWidth="2" />
    </g>
  );
}

const ART: Record<string, ReactNode> = {
  contact: (
    <svg viewBox="0 0 420 260" aria-hidden>
      <path d="M40 230 C120 120 250 250 400 60" fill="none" stroke={G.light} strokeWidth="28" strokeLinecap="round" opacity=".55" />
      <path d="M30 240 Q80 200 120 210" fill="none" stroke={G.mid} strokeWidth="2.5" strokeDasharray="7 8" />
      <path d="M262 92 Q300 70 330 40" fill="none" stroke={G.mid} strokeWidth="2.5" strokeDasharray="7 8" />
      <path d="M318 18 L390 6 L346 58 L338 40Z" fill={G.mid} />
      <path d="M338 40 L390 6 L326 36Z" fill={G.dark} />
      <g transform="translate(140 72)">
        <rect width="160" height="118" rx="14" fill={G.pale} stroke={G.light} strokeWidth="2" />
        <path d="M4 10 L80 72 L156 10" fill={G.white} stroke={G.light} strokeWidth="2" />
        <path d="M6 112 L66 60 M154 112 L94 60" stroke={G.light} strokeWidth="2" />
      </g>
      <g transform="translate(40 110)">
        <rect width="70" height="50" rx="10" fill={G.mid} />
        <path d="M16 50 L12 66 L32 50Z" fill={G.mid} />
        <circle cx="21" cy="25" r="5" fill={G.white} />
        <circle cx="35" cy="25" r="5" fill={G.white} />
        <circle cx="49" cy="25" r="5" fill={G.white} />
      </g>
      <g transform="translate(350 150)">
        <circle r="34" fill={G.light} />
        <circle cy="-8" r="11" fill={G.dark} />
        <path d="M-19 20 Q0 -4 19 20Z" fill={G.dark} />
      </g>
    </svg>
  ),
  help: (
    <svg viewBox="0 0 420 280" aria-hidden>
      <circle cx="330" cy="150" r="130" fill={G.light} opacity=".45" />
      <g transform="translate(130 40)">
        <rect width="240" height="190" rx="16" fill={G.white} stroke={G.line} strokeWidth="2" />
        <circle cx="22" cy="22" r="5" fill={G.navy} />
        <circle cx="38" cy="22" r="5" fill={G.navy} />
        <circle cx="54" cy="22" r="5" fill={G.navy} />
        <rect x="20" y="46" width="90" height="10" rx="5" fill={G.dark} />
        <rect x="20" y="66" width="70" height="9" rx="4.5" fill={G.navy} />
        {[86, 104, 122, 140].map((y) => (
          <rect key={y} x="20" y={y} width="86" height="8" rx="4" fill={G.line} />
        ))}
        <circle cx="168" cy="110" r="48" fill={G.pale} />
        <circle cx="166" cy="106" r="28" fill="none" stroke={G.navy} strokeWidth="9" />
        <path d="M186 128 L212 156" stroke={G.navy} strokeWidth="12" strokeLinecap="round" />
      </g>
      <g transform="translate(330 8)">
        <rect width="72" height="66" rx="12" fill={G.dark} />
        <path d="M14 66 L10 84 L32 66Z" fill={G.dark} />
        <text x="36" y="48" textAnchor="middle" fontSize="44" fontWeight="800" fill={G.white} fontFamily="inherit">
          ?
        </text>
      </g>
      <Plant x={100} y={210} scale={0.8} />
    </svg>
  ),
  careers: (
    <svg viewBox="0 0 420 300" aria-hidden>
      <path d="M0 290 C120 230 260 260 420 120 L420 300 L0 300Z" fill={G.light} opacity=".5" />
      <g transform="translate(110 70)">
        <rect width="260" height="160" rx="14" fill={G.white} stroke={G.line} strokeWidth="2" />
        <rect x="0" y="0" width="260" height="30" rx="14" fill={G.pale} />
        <circle cx="20" cy="15" r="4.5" fill={G.navy} />
        <circle cx="34" cy="15" r="4.5" fill={G.navy} />
        <circle cx="48" cy="15" r="4.5" fill={G.navy} />
        <rect x="22" y="48" width="74" height="12" rx="6" fill="#bfd7f5" />
        {[72, 90].map((y) => (
          <rect key={y} x="22" y={y} width="62" height="8" rx="4" fill={G.line} />
        ))}
        <circle cx="140" cy="88" r="32" fill="none" stroke={G.mid} strokeWidth="10" />
        <circle cx="140" cy="88" r="24" fill={G.pale} />
        <path d="M164 112 L192 140" stroke={G.navy} strokeWidth="12" strokeLinecap="round" />
        <path d="M0 160 H260 L276 176 H-16Z" fill={G.line} />
      </g>
      <g transform="translate(272 34)">
        <rect width="20" height="30" y="30" rx="3" fill={G.leaf} />
        <rect x="26" width="20" height="44" y="16" rx="3" fill={G.mid} />
        <rect x="52" width="20" height="60" y="0" rx="3" fill={G.dark} />
      </g>
      <path d="M300 60 L392 0" stroke={G.mid} strokeWidth="10" strokeLinecap="round" />
      <path d="M372 -6 L404 -10 L398 22Z" fill={G.mid} />
      <Plant x={100} y={230} scale={0.95} />
    </svg>
  ),
  legal: (
    <svg viewBox="0 0 420 260" aria-hidden>
      <circle cx="350" cy="80" r="120" fill={G.light} opacity=".4" />
      <g transform="translate(170 20)">
        <rect width="170" height="210" rx="14" fill={G.white} stroke={G.line} strokeWidth="2" />
        <rect x="22" y="26" width="70" height="11" rx="5.5" fill={G.dark} />
        <rect x="22" y="46" width="52" height="10" rx="5" fill={G.mid} />
        <rect x="82" y="46" width="34" height="10" rx="5" fill={G.light} />
        {[70, 90, 110, 130, 150, 170].map((y, i) => (
          <rect key={y} x="22" y={y} width={i % 2 ? 66 : 84} height="8" rx="4" fill={G.light} />
        ))}
      </g>
      <g transform="translate(300 98)">
        <path d="M0 0 L58 -20 L116 0 V58 C116 104 80 128 58 138 C36 128 0 104 0 58Z" fill={G.dark} stroke={G.white} strokeWidth="6" />
        <rect x="38" y="56" width="40" height="34" rx="6" fill={G.white} />
        <path d="M46 56 V46 A12 12 0 0 1 70 46 V56" fill="none" stroke={G.white} strokeWidth="7" />
        <circle cx="58" cy="72" r="5" fill={G.dark} />
      </g>
      <Plant x={160} y={190} scale={0.8} />
    </svg>
  ),
};

/** Mint hero with copy on the left and an illustration on the right. */
export function ArtHero({ eyebrow, title, lead, art, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; art: keyof typeof ART | string; children?: ReactNode }) {
  return (
    <section className={s.artHero}>
      <div className={s.artHeroIn}>
        <div>
          <div className={s.eyebrow}>{eyebrow}</div>
          <h1 className={s.title}>{title}</h1>
          {lead && <p className={s.lead}>{lead}</p>}
          {children}
        </div>
        <div className={s.art}>{ART[art]}</div>
      </div>
    </section>
  );
}
