import { useState } from 'react';
import NumInput from './NumInput';

type Series = { label: string; values: number[] }; // nilai dalam mm

type Props = { xs: number[]; series: Series[]; L: number };

function interp(xs: number[], vs: number[], x: number) {
  if (x <= xs[0]) return vs[0];
  for (let k = 0; k < xs.length - 1; k++) {
    if (x >= xs[k] && x <= xs[k + 1]) {
      const t = xs[k + 1] - xs[k] > 1e-12 ? (x - xs[k]) / (xs[k + 1] - xs[k]) : 0;
      return vs[k] + (vs[k + 1] - vs[k]) * t;
    }
  }
  return vs[vs.length - 1];
}

export default function DeflectionQuery({ xs, series, L }: Props) {
  const [xq, setXq] = useState(L / 2);
  const pts = Array.from({ length: 11 }, (_, k) => (L * k) / 10);
  const cell = { padding: '4px 10px', textAlign: 'right' as const };

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ margin: '0 0 6px' }}>Lendutan di setiap posisi</h3>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
        <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column' }}>
          Cek di posisi x (m)
          <NumInput value={xq} onChange={setXq} width={100} />
        </label>
        <span style={{ fontSize: 14 }}>
          {xq < 0 || xq > L ? (
            <b style={{ color: '#b91c1c' }}>x harus antara 0 dan {L}</b>
          ) : (
            series.map((s) => (
              <span key={s.label} style={{ marginRight: 16 }}>
                {s.label}: <b>{interp(xs, s.values, xq).toFixed(4)} mm</b>
              </span>
            ))
          )}
        </span>
      </div>

      <table border={1} style={{ borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={cell}>x (m)</th>
            {series.map((s) => (
              <th key={s.label} style={cell}>
                {s.label}
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
                  {interp(xs, s.values, x).toFixed(4)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: '#555' }}>Tanda + = ke atas / ke kanan, tanda − = ke bawah / ke kiri.</p>
    </div>
  );
}
