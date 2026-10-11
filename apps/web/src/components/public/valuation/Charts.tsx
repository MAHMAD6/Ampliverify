import { compact, monthLabel, type TrendPoint } from '@/lib/valuation';

const W = 320;
const H = 150;
const PAD = { l: 34, r: 8, t: 10, b: 22 };

function scale(points: TrendPoint[]) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const x = (i: number) => PAD.l + (points.length < 2 ? 0 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / top);
  return { top, x, y };
}

function Axes({ top, y, points, x }: { top: number; y: (v: number) => number; points: TrendPoint[]; x: (i: number) => number }) {
  const ticks = [0, top / 3, (2 * top) / 3, top];
  const every = Math.max(1, Math.ceil(points.length / 6));
  return (
    <g fontSize="9" fill="#5d6b7c">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e3e9e5" />
          <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end">
            {compact(Math.round(t))}
          </text>
        </g>
      ))}
      {points.map((p, i) =>
        i % every === 0 || i === points.length - 1 ? (
          <text key={p.month} x={x(i)} y={H - 6} textAnchor="middle">
            {monthLabel(p.month)}
          </text>
        ) : null,
      )}
    </g>
  );
}

/** Line + area trend. Renders an honest empty state without data. */
export function LineChart({ points, label }: { points: TrendPoint[]; label: string }) {
  if (points.length < 2) return <p style={{ fontSize: 13, color: '#5d6b7c', margin: '12px 0' }}>No history available for this metric yet.</p>;
  const { top, x, y } = scale(points);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto' }}>
      <Axes top={top} y={y} points={points} x={x} />
      <path d={area} fill="#1e9c45" opacity="0.12" />
      <path d={line} fill="none" stroke="#15803d" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={p.month} cx={x(i)} cy={y(p.value)} r="2.4" fill="#15803d" />
      ))}
    </svg>
  );
}

export function BarChart({ points, label }: { points: TrendPoint[]; label: string }) {
  if (points.length < 2) return <p style={{ fontSize: 13, color: '#5d6b7c', margin: '12px 0' }}>No history available for this metric yet.</p>;
  const { top, x, y } = scale(points);
  const bw = Math.max(6, ((W - PAD.l - PAD.r) / points.length) * 0.6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', height: 'auto' }}>
      <Axes top={top} y={y} points={points} x={x} />
      {points.map((p, i) => (
        <rect key={p.month} x={Math.min(Math.max(PAD.l, x(i) - bw / 2), W - PAD.r - bw)} y={y(p.value)} width={bw} height={y(0) - y(p.value)} rx="2" fill="#5cc28a" />
      ))}
    </svg>
  );
}

/** Small decorative trend line for metric tiles (real data only). */
export function Sparkline({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const span = max - min || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i * 90) / (points.length - 1)).toFixed(1)} ${(30 - ((p.value - min) / span) * 26).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 90 32" aria-hidden style={{ width: 90, height: 32 }}>
      <path d={d} fill="none" stroke="#1e9c45" strokeWidth="2" />
    </svg>
  );
}

export const DONUT_COLORS = ['#15803d', '#f59e0b', '#5cc28a', '#ef9a3a', '#7c5cf0', '#3b5bdb'];

export function Donut({ parts, center, sub }: { parts: { label: string; value: number }[]; center: string; sub: string }) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  let acc = 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Value breakdown" style={{ width: 150, height: 150, flex: 'none' }}>
      <g transform="rotate(-90 60 60)">
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx="60" cy="60" r={r} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </g>
      <text x="60" y="58" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0b1b35">
        {center}
      </text>
      <text x="60" y="73" textAnchor="middle" fontSize="8" fill="#5d6b7c">
        {sub}
      </text>
    </svg>
  );
}

/** Circular percentage gauge (confidence). */
export function Gauge({ value, size = 76, label }: { value: number; size?: number; label?: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 76 76" width={size} height={size} role="img" aria-label={label ?? `${value}%`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="#e4f5e8" strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="#15803d" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="43" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0e5e2b">
        {value}%
      </text>
    </svg>
  );
}
