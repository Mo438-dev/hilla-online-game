// Server-rendered chart primitives for /admin/analytics. Pure JSX/SVG — no
// client JS, nothing to hydrate, safe inside a server component.

export const PALETTE = {
  maroon: '#6B1F2A',
  gold: '#C9A227',
  teal: '#1F6F6B',
  ink: '#2B211C',
  green: '#2F7D4F',
  blue: '#2C5E9E',
  gray: '#9A948A',
  red: '#B3362B',
  purple: '#5B2C6F',
};

export function Card({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e8e4dc',
        borderRadius: 14,
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(43,33,28,0.06)',
        gridColumn: wide ? '1 / -1' : undefined,
        minWidth: 0,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: PALETTE.ink }}>{title}</h2>
      {sub && <p style={{ fontSize: 12, color: '#7d766c', margin: '4px 0 12px' }}>{sub}</p>}
      {!sub && <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'muted' }) {
  const color = tone === 'good' ? PALETTE.green : tone === 'bad' ? PALETTE.red : PALETTE.ink;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(43,33,28,0.06)' }}>
      <div style={{ fontSize: 11, color: '#7d766c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.2, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9a948a', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Empty({ text }: { text?: string }) {
  return (
    <div style={{ padding: '18px 0', color: '#9a948a', fontSize: 13, textAlign: 'center' }}>
      {text || 'Not enough data yet — play a few games first.'}
    </div>
  );
}

type BarDatum = { label: string; value: number; color?: string; hint?: string };

// Horizontal bars with value labels. `format` renders the value text.
export function Bars({ data, format, maxOverride }: { data: BarDatum[]; format?: (v: number) => string; maxOverride?: number }) {
  if (!data.length) return <Empty />;
  const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1e-9);
  const fmt = format || ((v: number) => String(Math.round(v * 100) / 100));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 62px', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <div style={{ color: PALETTE.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.hint || d.label}>
            {d.label}
          </div>
          <div style={{ background: '#f1ede5', borderRadius: 5, height: 16, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(1.5, (d.value / max) * 100)}%`,
                height: '100%',
                background: d.color || PALETTE.maroon,
                borderRadius: 5,
              }}
            />
          </div>
          <div style={{ color: '#5b554b', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

// One 100% stacked bar with a legend — for share-of-total breakdowns.
export function StackedBar({ segments }: { segments: BarDatum[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <Empty />;
  return (
    <div>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid #e8e4dc' }}>
        {segments.map(
          (s, i) =>
            s.value > 0 && (
              <div key={i} title={`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
            )
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8, fontSize: 11, color: '#5b554b' }}>
        {segments.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            {s.label} · {total ? ((s.value / total) * 100).toFixed(1) : 0}% ({s.value})
          </span>
        ))}
      </div>
    </div>
  );
}

// Small trend line (e.g. games per day).
export function Trend({ points, height = 72 }: { points: Array<{ label: string; value: number }>; height?: number }) {
  if (points.length < 2) return <Empty text="Needs at least two days of data." />;
  const w = 560;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = w / (points.length - 1);
  const xy = points.map((p, i) => [i * step, height - (p.value / max) * (height - 10) - 4]);
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
        <path d={path} fill="none" stroke={PALETTE.maroon} strokeWidth={2} />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.4} fill={PALETTE.gold} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9a948a' }}>
        <span>{points[0].label}</span>
        <span>
          peak {max} — {points.reduce((a, p) => a + p.value, 0)} total
        </span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

// Simple bucketed distribution (vertical bars).
export function Distribution({ buckets, height = 80 }: { buckets: Array<{ label: string; value: number; color?: string }>; height?: number }) {
  if (!buckets.length || buckets.every((b) => !b.value)) return <Empty />;
  const max = Math.max(...buckets.map((b) => b.value), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
        {buckets.map((b, i) => (
          <div key={i} title={`${b.label}: ${b.value}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 3 : 0, background: b.color || PALETTE.teal, borderRadius: '3px 3px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, fontSize: 9.5, color: '#9a948a', marginTop: 3 }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export const tableTh: React.CSSProperties = { textAlign: 'left', borderBottom: '2px solid #e8e4dc', padding: '6px 8px', fontSize: 11, color: '#7d766c', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap' };
export const tableTd: React.CSSProperties = { borderBottom: '1px solid #f1ede5', padding: '6px 8px', fontSize: 12.5, color: PALETTE.ink, fontVariantNumeric: 'tabular-nums' };

export function Flag({ kind, text }: { kind: 'warn' | 'ok' | 'info'; text: string }) {
  const c = kind === 'warn' ? { bg: '#fdf0ee', fg: PALETTE.red } : kind === 'ok' ? { bg: '#eef6f0', fg: PALETTE.green } : { bg: '#f1ede5', fg: '#7d766c' };
  return (
    <span style={{ background: c.bg, color: c.fg, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>
  );
}
