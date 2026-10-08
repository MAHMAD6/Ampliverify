import s from './geo.module.css';

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#e11d48', '#0891b2'];

/**
 * Visibility trend (0–100%) as one line per series. Server-rendered SVG, no
 * chart library; callers only pass series with at least two points.
 */
export function TrendChart({ series, title = 'Visibility Trend' }: { series: { name: string; points: { at: string; value: number }[] }[]; title?: string }) {
  const all = series.flatMap((x) => x.points.map((p) => Date.parse(p.at)));
  const min = Math.min(...all);
  const span = Math.max(Math.max(...all) - min, 1);
  const W = 640;
  const H = 160;
  const x = (at: string) => 30 + ((Date.parse(at) - min) / span) * (W - 40);
  const y = (v: number) => 10 + (1 - v / 100) * (H - 30);
  const fmt = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <figure className={s.trendWrap}>
      <h3>{title}</h3>
      <svg className={s.trend} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}: ${series.map((x) => `${x.name} ${x.points[x.points.length - 1]?.value ?? 0}%`).join(', ')}`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={30} x2={W - 10} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 3" />
            <text x={0} y={y(v) + 4} fontSize={10} fill="var(--muted)">
              {v}%
            </text>
          </g>
        ))}
        <text x={30} y={H - 2} fontSize={10} fill="var(--muted)">
          {fmt(min)}
        </text>
        <text x={W - 10} y={H - 2} fontSize={10} fill="var(--muted)" textAnchor="end">
          {fmt(min + span)}
        </text>
        {series.map((ser, i) => (
          <polyline key={ser.name} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={2} vectorEffect="non-scaling-stroke" points={ser.points.map((p) => `${x(p.at)},${y(p.value)}`).join(' ')} />
        ))}
      </svg>
      <figcaption className={s.chips}>
        {series.map((ser, i) => (
          <span key={ser.name} className={s.chip}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS[i % COLORS.length] }} />
            {ser.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
