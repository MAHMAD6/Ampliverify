import { Info } from 'lucide-react';

export type SectionPayload = {
  title: string;
  summary?: string;
  metrics?: { label: string; value: string }[];
  table?: { columns: string[]; rows: string[][] };
  bullets?: string[];
  empty?: string;
};

/** Renders stored report sections (same payload as the HTML/PDF export). */
export function ReportSections({ sections }: { sections: SectionPayload[] }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {sections.map((s, i) => {
        const hasData = !!(s.metrics?.length || s.table?.rows.length || s.bullets?.length);
        return (
          <section key={i} id={`section-${i}`} style={{ background: 'var(--card, #fff)', border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{s.title}</h2>
            {s.summary && <p style={{ color: 'var(--muted)', margin: '0 0 10px' }}>{s.summary}</p>}
            {s.metrics && s.metrics.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '8px 0' }}>
                {s.metrics.map((m) => (
                  <div key={m.label} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                    <strong style={{ display: 'block', fontSize: 22 }}>{m.value}</strong>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{m.label}</span>
                  </div>
                ))}
              </div>
            )}
            {s.bullets && s.bullets.length > 0 && (
              <ul>
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {s.table && s.table.rows.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      {s.table.columns.map((c) => (
                        <th key={c} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--line)', background: 'var(--bg-subtle, #f8fafc)' }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} style={{ padding: 8, borderBottom: '1px solid var(--line)', wordBreak: 'break-word' }}>
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!hasData && s.empty && (
              <p style={{ color: 'var(--muted)' }}>
                <Info size={14} style={{ verticalAlign: 'middle' }} /> {s.empty}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
