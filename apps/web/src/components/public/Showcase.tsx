import { BarChart3, Calendar, CheckCircle2, FileText, FolderOpen, KeyRound, LayoutGrid, Lightbulb, Search, Sparkles, TrendingUp } from 'lucide-react';
import { CalculatorForm } from './valuation/CalculatorForm';
import s from './site.module.css';

/** Laptop with the product dashboard (illustration; labelled as sample data). */
export function LaptopMock() {
  const nav = [
    [<LayoutGrid key="o" size={13} />, 'Overview'],
    [<Search key="a" size={13} />, 'SEO Audit'],
    [<FileText key="c" size={13} />, 'Content Audit'],
    [<Sparkles key="g" size={13} />, 'Geo / AI Search'],
    [<Lightbulb key="r" size={13} />, 'Recommendations'],
    [<BarChart3 key="p" size={13} />, 'Reports'],
    [<FolderOpen key="j" size={13} />, 'Projects'],
  ] as const;
  const line = 'M0 60 L20 52 L40 55 L60 44 L80 46 L100 36 L120 38 L140 28 L160 24 L180 14 L200 8';
  return (
    <div className={s.laptop} aria-label="AmpliVerify dashboard illustration with sample data">
      <div className={s.laptopScreen}>
        <aside>
          <b>AmpliVerify</b>
          {nav.map(([icon, label], i) => (
            <span key={label} className={i === 0 ? s.lapOn : undefined}>
              {icon} {label}
            </span>
          ))}
        </aside>
        <div className={s.lapMain}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 13 }}>Website Performance</b>
            <span className={s.sample}>Sample data</span>
          </div>
          <div className={s.lapStats}>
            <div className={s.lapRing}>
              <svg viewBox="0 0 44 44" aria-hidden>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#e4f5e8" strokeWidth="5" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="#15803d" strokeWidth="5" strokeDasharray="88 113" transform="rotate(-90 22 22)" strokeLinecap="round" />
              </svg>
              <span>
                78<small>SEO Score</small>
              </span>
            </div>
            {[
              ['Issues', '24', '#dc2626'],
              ['Warnings', '36', '#d97706'],
              ['Passed', '122', '#15803d'],
            ].map(([l, v, c]) => (
              <div key={l} className={s.lapStat}>
                <small>{l}</small>
                <b style={{ color: c }}>{v}</b>
                <svg viewBox="0 0 40 10" aria-hidden>
                  <path d="M0 7 L8 3 L16 6 L24 2 L32 5 L40 3" fill="none" stroke={c} strokeWidth="1.5" />
                </svg>
              </div>
            ))}
          </div>
          <div className={s.lapChart}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b style={{ fontSize: 12 }}>Organic Traffic</b>
              <b style={{ fontSize: 12, color: '#15803d' }}>
                +52% <TrendingUp size={12} />
              </b>
            </div>
            <svg viewBox="0 0 200 64" preserveAspectRatio="none" aria-hidden>
              <path d={`${line} L200 64 L0 64 Z`} fill="#1e9c45" opacity="0.12" />
              <path d={line} fill="none" stroke="#15803d" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
      <div className={s.laptopBase} />
    </div>
  );
}

/** "FREE TOOL — Website Value Calculator" band (Home and Features). */
export function ValueTeaser({ available, reason }: { available: boolean; reason?: string }) {
  return (
    <section className={s.section} style={{ paddingTop: 24 }}>
      <div className={s.container}>
        <div className={s.teaser}>
          <div>
            <div className={s.eyebrowSpaced}>Free Tool</div>
            <h2 className={s.h2}>Website Value Calculator</h2>
            <p className={s.lead} style={{ fontSize: 17 }}>
              Get an instant estimate of your website’s value based on real SEO, traffic, and domain signals. It’s free for everyone — no account required.
            </p>
            <div style={{ marginTop: 18 }}>
              <CalculatorForm icon="link" disabled={!available} disabledReason={reason} notes={['Free for everyone', 'Instant results', 'No signup required', 'Actionable insights']} />
            </div>
          </div>
          <div className={s.teaserCard} aria-label="Example result">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>Estimated Website Value</b>
              <span className={s.sample}>Example</span>
            </div>
            <div className={s.teaserValue}>$12,500</div>
            <p style={{ textAlign: 'center', color: 'var(--ink2)', fontSize: 15 }}>Value range: $9,000 – $18,000</p>
            <div className={s.teaserStats}>
              {[
                [<BarChart3 key="t" size={22} />, 'Organic Traffic', '4.8K'],
                [<KeyRound key="k" size={22} />, 'Keyword Value', '$6.2K'],
                [<Calendar key="d" size={22} />, 'Domain Age', '8.5 years'],
              ].map(([icon, l, v]) => (
                <div key={String(l)}>
                  <span style={{ color: 'var(--g700)' }}>{icon}</span>
                  <span>
                    <small>{l}</small>
                    <b>{v}</b>
                  </span>
                </div>
              ))}
            </div>
            <p className={s.teaserNote}>
              <CheckCircle2 size={14} /> Valuation is an estimate based on SEO and market data. Results may vary.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Four-up feature/benefit strip under a hero. */
export function FeatureStrip({ items }: { items: { icon: React.ReactNode; title: string; text: string }[] }) {
  return (
    <section className={s.strip}>
      <div className={`${s.container} ${s.stripIn}`}>
        {items.map((i) => (
          <div key={i.title} className={s.stripItem}>
            <span className={s.icon}>{i.icon}</span>
            <div>
              <b>{i.title}</b>
              <small>{i.text}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

