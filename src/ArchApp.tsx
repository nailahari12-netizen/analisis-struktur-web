import { useMemo, useState } from 'react';
import ArchView from './components/ArchView';
import DeflectionQuery from './components/DeflectionQuery';
import DiagramChart from './components/DiagramChart';
import ForceQuery from './components/ForceQuery';
import NumInput from './components/NumInput';
import { analyzeArch, type ArchInput, type ArchPointLoad, type ArchType } from './solver/arch';

const box = { border: '1px solid #ccc', borderRadius: 6, padding: 10, marginBottom: 10 };

function Field(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
      {props.label}
      <NumInput value={props.value} onChange={props.onChange} width={110} />
    </label>
  );
}

export default function ArchApp() {
  const [L, setL] = useState(10);
  const [f, setF] = useState(3);
  const [n, setN] = useState(40);
  const [type, setType] = useState<ArchType>('twoHinged');
  const [wH, setWH] = useState(10);
  const [x1, setX1] = useState(0);
  const [x2, setX2] = useState(10);
  const [wArc, setWArc] = useState(0);
  const [pointLoads, setPointLoads] = useState<ArchPointLoad[]>([]);
  const [E, setE] = useState(25);
  const [I, setI] = useState(720000);
  const [A, setA] = useState(2400);
  const [animate, setAnimate] = useState(false);

  const inp: ArchInput = useMemo(
    () => ({ L, f, n, type, wH, x1, x2, wArc, pointLoads, E, I, A }),
    [L, f, n, type, wH, x1, x2, wArc, pointLoads, E, I, A],
  );
  const r = useMemo(() => analyzeArch(inp), [inp]);

  const setPL = (i: number, key: keyof ArchPointLoad, v: number) =>
    setPointLoads(pointLoads.map((p, j) => (j === i ? { ...p, [key]: v } : p)));

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 740 }}>
      <h1>Analisis Busur Lingkaran (Round Arch)</h1>

      <div style={{ ...box, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Field label="Bentang L (m)" value={L} onChange={setL} />
        <Field label="Tinggi busur f (m)" value={f} onChange={setF} />
        <Field label="Jumlah segmen" value={n} onChange={setN} />
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
          Jenis tumpuan
          <select value={type} style={{ padding: 4 }} onChange={(e) => setType(e.target.value as ArchType)}>
            <option value="twoHinged">Dua sendi</option>
            <option value="fixed">Jepit-jepit</option>
            <option value="threeHinged">Tiga sendi (sendi di puncak)</option>
          </select>
        </label>
      </div>

      <div style={{ ...box, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Field label="E (GPa)" value={E} onChange={setE} />
        <Field label="I (cm⁴)" value={I} onChange={setI} />
        <Field label="A (cm²)" value={A} onChange={setA} />
      </div>

      <div style={{ ...box, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Field label="w merata (kN/m, per proyeksi horizontal)" value={wH} onChange={setWH} />
        <Field label="dari x (m)" value={x1} onChange={setX1} />
        <Field label="sampai x (m)" value={x2} onChange={setX2} />
        <Field label="w berat sendiri (kN/m, per panjang busur)" value={wArc} onChange={setWArc} />
      </div>

      <div style={box}>
        <b>Beban titik (P + ke bawah, H + ke kanan)</b>
        {pointLoads.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 6 }}>
            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column' }}>
              x (m)
              <NumInput value={p.x} onChange={(v) => setPL(i, 'x', v)} />
            </label>
            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column' }}>
              P (kN)
              <NumInput value={p.P} onChange={(v) => setPL(i, 'P', v)} />
            </label>
            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column' }}>
              H (kN)
              <NumInput value={p.H} onChange={(v) => setPL(i, 'H', v)} />
            </label>
            <button onClick={() => setPointLoads(pointLoads.filter((_, j) => j !== i))}>Hapus</button>
          </div>
        ))}
        <button
          style={{ marginTop: 6 }}
          onClick={() => setPointLoads([...pointLoads, { x: L / 2, P: 10, H: 0 }])}
        >
          + Tambah
        </button>
      </div>

      {!r.ok ? (
        <p style={{ color: '#b91c1c', fontWeight: 600 }}>{r.error}</p>
      ) : (
        <>
          <ArchView input={inp} nodes={r.nodes} u={r.u} animate={animate} />
          <label style={{ fontSize: 13, display: 'block', margin: '6px 0' }}>
            <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />{' '}
            Animasikan deformasi
          </label>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>
            Garis merah putus-putus = bentuk deformasi (diperbesar). Animasi hanya efek tampilan, hasil hitungan
            tetap statis. Radius busur R = {r.radius.toFixed(3)} m, panjang busur = {r.arcLength.toFixed(3)} m.
          </p>

          <h3>Reaksi tumpuan</h3>
          <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Tumpuan</th>
                <th>Rx (kN, → +)</th>
                <th>Ry (kN, ↑ +)</th>
                <th>Mz (kNm, ↻ +)</th>
              </tr>
            </thead>
            <tbody>
              {r.supports.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td>{(s.Rx / 1000).toFixed(3)}</td>
                  <td>{(s.Ry / 1000).toFixed(3)}</td>
                  <td>{(s.Mz / 1000).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13 }}>
            Gaya dorong horizontal (thrust) tumpuan kiri: <b>{(Math.abs(r.supports[0].Rx) / 1000).toFixed(3)} kN</b>
            <br />
            Cek keseimbangan: ΣRy = <b>{(r.sumRy / 1000).toFixed(3)} kN</b>, total beban vertikal ={' '}
            <b>{(r.totalV / 1000).toFixed(3)} kN</b>
            <br />
            ΣRx = <b>{(r.sumRx / 1000).toFixed(3)} kN</b>, total beban horizontal ={' '}
            <b>{(r.totalH / 1000).toFixed(3)} kN</b> (ΣRx harus = −beban horizontal)
          </p>

          <h3>Nilai ekstrem</h3>
          <ul style={{ fontSize: 13 }}>
            <li>
              Momen positif maks: <b>{(r.maxM.value / 1000).toFixed(3)} kNm</b> di x = {r.maxM.x.toFixed(2)} m
            </li>
            <li>
              Momen negatif maks: <b>{(r.minM.value / 1000).toFixed(3)} kNm</b> di x = {r.minM.x.toFixed(2)} m
            </li>
            <li>
              Gaya aksial tekan maks: <b>{(Math.abs(r.minN.value) / 1000).toFixed(3)} kN</b> di x ={' '}
              {r.minN.x.toFixed(2)} m
            </li>
            <li>
              Geser maks: <b>{(Math.abs(r.maxV.value) / 1000).toFixed(3)} kN</b> di x = {r.maxV.x.toFixed(2)} m
            </li>
          </ul>

          <DiagramChart
            title="NFD (gaya aksial, tarik +, tekan −)"
            unit="kN"
            xs={r.diagram.x}
            ys={r.diagram.N.map((v) => v / 1000)}
            L={L}
            color="#059669"
          />
          <DiagramChart
            title="SFD (gaya geser, tegak lurus busur)"
            unit="kN"
            xs={r.diagram.x}
            ys={r.diagram.V.map((v) => v / 1000)}
            L={L}
            color="#1a56db"
          />
          <DiagramChart
            title="BMD (momen lentur)"
            unit="kNm"
            xs={r.diagram.x}
            ys={r.diagram.M.map((v) => v / 1000)}
            L={L}
            color="#7c3aed"
            flip
          />
          <ForceQuery
            xs={r.diagram.x}
            L={L}
            series={[
              { label: 'Aksial N', unit: 'kN', values: r.diagram.N.map((v) => v / 1000) },
              { label: 'Geser V', unit: 'kN', values: r.diagram.V.map((v) => v / 1000) },
              { label: 'Momen M', unit: 'kNm', values: r.diagram.M.map((v) => v / 1000) },
            ]}
          />
          <DiagramChart
            title="Lendutan vertikal (+ ke atas)"
            unit="mm"
            xs={r.nodes.map((nd) => nd.x)}
            ys={r.u.filter((_, i) => i % 3 === 1).map((v) => v * 1000)}
            L={L}
            color="#e02424"
          />
          <DiagramChart
            title="Lendutan horizontal (+ ke kanan)"
            unit="mm"
            xs={r.nodes.map((nd) => nd.x)}
            ys={r.u.filter((_, i) => i % 3 === 0).map((v) => v * 1000)}
            L={L}
            color="#ea580c"
          />
          <DeflectionQuery
            xs={r.nodes.map((nd) => nd.x)}
            L={L}
            series={[
              { label: 'Vertikal', values: r.u.filter((_, i) => i % 3 === 1).map((v) => v * 1000) },
              { label: 'Horizontal', values: r.u.filter((_, i) => i % 3 === 0).map((v) => v * 1000) },
            ]}
          />
        </>
      )}
    </div>
  );
}
