/** Usage ring. With no data it renders an empty track and an em dash. */
export function CreditsDonut({ used, total, size = 132 }: { used?: number; total?: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const known = used !== undefined && total !== undefined && total > 0;
  const remainingRatio = known ? Math.max(0, (total - used) / total) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={known ? `${total - used} credits remaining` : 'Credits remaining not available'}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--blue-100)" strokeWidth={12} />
      {known && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--blue)"
          strokeWidth={12}
          strokeDasharray={`${c * remainingRatio} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text x="50%" y="46%" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--ink)">
        {known ? (total - used).toLocaleString('en-US') : '—'}
      </text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="var(--muted)">
        credits remaining
      </text>
    </svg>
  );
}
