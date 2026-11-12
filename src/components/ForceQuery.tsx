import { useState } from 'react';
import NumInput from './NumInput';

type Series = { label: string; unit: string; values: number[] };
type Props = { xs: number[]; series: Series[]; L: number; title?: string };
type Val = { left: number; right: number };

// Nilai di posisi x. Pada titik loncat (beban terpusat, tumpuan, sendi) ada dua nilai: kiri dan kanan.
function valueAt(xs: number[], vs: number[], x: number): Val {
  const hits: number[] = [];
  xs.forEach((p, i) => {
    if (Math.abs(p - x) < 1e-6) hits.push(i);
  });
  if (hits.length > 0) return { left: vs[hits[0]], right: vs[hits[hits.length - 1]] };
  for (let i = 0; i < xs.length - 1; i++) {
    if (x > xs[i] && x < xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      const v = vs[i] + (vs[i + 1] - vs[i]) * t;
      return { left: v, right: v };
    }
  }
  const v = x < xs[0] ? vs[0] : vs[vs.length - 1];
  return { left: v, right: v };
}

const jumps = (v: Val) => Math.abs(v.left - v.right) > 5e-4;
const fmt = (n: number) => (Math.abs(n) < 5e-5 ? 0 : n).toFixed(3);
const show = (v: Val) => (jumps(v) ? `${fmt(v.left)} | ${fmt(v.right)}` : fmt(v.left));

export default function ForceQuery({ xs, series, L, title = 'Gaya dalam di setiap posisi' }: Props) {
  const [xq, setXq] = useState(L / 2);
  const pts = Array.from({ length: 11 }, (_, k) => (L * k) / 10);
  const cell = { padding: '4px 10px', textAlign: 'right' as const };
  const valid = xq >= 0 && xq <= L;

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ margin: '0 0 6px' }}>{title}</h3>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
        <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column' }}>
          Cek di posisi x (m)
          <NumInput value={xq} onChange={setXq} width={100} />
        </label>
        {!valid ? (
          <b style={{ color: '#b91c1c', fontSize: 14 }}>x harus antara 0 dan {L}</b>
        ) : (
          series.map((s) => {
            const v = valueAt(xs, s.values, xq);
            return (
              <span key={s.label} style={{ fontSize: 14 }}>
                {s.label}: <b>{show(v)} {s.unit}</b>
              </span>
            );
          })
        )}
      </div>

      <table border={1} style={{ borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={cell}>x (m)</th>
            {series.map((s) => (
              <th key={s.label} style={cell}>
                {s.label} ({s.unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pts.map((x) => (
            <tr key={x}>
              <td style={cell}>{x.toFixed(2)}</td>
              {series.map((s) => (
                <td key={s.label} style={cell}>
                  {show(valueAt(xs, s.values, x))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: '#555' }}>
        Tanda &quot;a | b&quot; berarti nilainya melompat di titik itu (a = sedikit di kiri, b = sedikit di kanan),
        biasanya karena beban terpusat, momen terpusat, atau tumpuan.
      </p>
    </div>
  );
}
