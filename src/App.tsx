import { useMemo, useState } from 'react';
import BeamView from './components/BeamView';
import DeflectionQuery from './components/DeflectionQuery';
import DiagramChart from './components/DiagramChart';
import ForceQuery from './components/ForceQuery';
import NumInput from './components/NumInput';
import {
  analyzeBeam,
  type BeamInput,
  type BeamSupport,
  type LineLoad,
  type MomentLoad,
  type PointLoad,
  type SupportType,
} from './solver/beam';
import {
  MATERIALS,
  STEEL_SECTIONS,
  allowableBending,
  checkBeam,
  effectiveSpan,
  rectSection,
  stabilityHint,
  suggestSteelSection,
} from './solver/design';

const box = { border: '1px solid #ccc', borderRadius: 6, padding: 10, marginBottom: 10 };

type FieldDef<T> = { key: keyof T; label: string };

function NumRows<T extends Record<string, number>>(props: {
  title: string;
  items: T[];
  fields: FieldDef<T>[];
  make: () => T;
  onChange: (v: T[]) => void;
}) {
  const { items, fields, onChange } = props;
  return (
    <div style={box}>
      <b>{props.title}</b>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 6 }}>
          {fields.map((f) => (
            <label key={String(f.key)} style={{ fontSize: 12, display: 'flex', flexDirection: 'column' }}>
              {f.label}
              <NumInput
                value={it[f.key]}
                onChange={(v) =>
                  onChange(items.map((o, j) => (j === i ? ({ ...o, [f.key]: v } as T) : o)))
                }
              />
            </label>
          ))}
          <button onClick={() => onChange(items.filter((_, j) => j !== i))}>Hapus</button>
        </div>
      ))}
      <button style={{ marginTop: 6 }} onClick={() => onChange([...items, props.make()])}>
        + Tambah
      </button>
    </div>
  );
}

function SupportRows(props: { items: BeamSupport[]; onChange: (v: BeamSupport[]) => void }) {
  const { items, onChange } = props;
  return (
    <div style={box}>
      <b>Tumpuan</b>
      {items.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 6 }}>
          <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column' }}>
            x (m)
            <NumInput
              value={s.x}
              onChange={(v) => onChange(items.map((o, j) => (j === i ? { ...o, x: v } : o)))}
            />
          </label>
          <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column' }}>
            Jenis
            <select
              value={s.type}
              style={{ width: 90, padding: 3 }}
              onChange={(e) =>
                onChange(items.map((o, j) => (j === i ? { ...o, type: e.target.value as SupportType } : o)))
              }
            >
              <option value="pin">Sendi</option>
              <option value="roller">Rol</option>
              <option value="fixed">Jepit</option>
            </select>
          </label>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))}>Hapus</button>
        </div>
      ))}
      <button style={{ marginTop: 6 }} onClick={() => onChange([...items, { x: 0, type: 'roller' }])}>
        + Tambah
      </button>
    </div>
  );
}

function Field(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
      {props.label}
      <NumInput value={props.value} onChange={props.onChange} width={110} />
    </label>
  );
}

const colors = {
  aman: { bg: '#ecfdf5', border: '#059669', text: '#065f46' },
  gagal: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
  perlu: { bg: '#fffbeb', border: '#d97706', text: '#92400e' },
};

export default function App() {
  const [L, setL] = useState(8);
  const [supports, setSupports] = useState<BeamSupport[]>([
    { x: 0, type: 'pin' },
    { x: 4, type: 'roller' },
    { x: 8, type: 'roller' },
  ]);
  const [hinges, setHinges] = useState<{ x: number }[]>([]);
  const [lineLoads, setLineLoads] = useState<LineLoad[]>([{ x1: 0, x2: 8, w1: 10, w2: 10 }]);
  const [pointLoads, setPointLoads] = useState<PointLoad[]>([]);
  const [moments, setMoments] = useState<MomentLoad[]>([]);
  const [animate, setAnimate] = useState(false);

  // bahan dan penampang
  const [matId, setMatId] = useState('bj37');
  const [customE, setCustomE] = useState(200);
  const [customAllow, setCustomAllow] = useState(160);
  const [secMode, setSecMode] = useState<'iwf' | 'rect' | 'manual'>('iwf');
  const [presetId, setPresetId] = useState('iwf300');
  const [rb, setRb] = useState(25);
  const [rh, setRh] = useState(40);
  const [mA, setMA] = useState(100);
  const [mI, setMI] = useState(10000);
  const [mH, setMH] = useState(30);
  const [limitDen, setLimitDen] = useState(360);

  const base = MATERIALS.find((m) => m.id === matId) ?? MATERIALS[0];
  const material = base.kind === 'custom' ? { ...base, E: customE, strength: customAllow } : base;

  const section = useMemo(() => {
    if (secMode === 'iwf') {
      const p = STEEL_SECTIONS.find((s) => s.id === presetId) ?? STEEL_SECTIONS[0];
      return { h: p.h, I: p.I, A: p.A, label: p.name };
    }
    if (secMode === 'rect') {
      const s = rectSection(rb, rh);
      return { ...s, label: `Persegi ${rb} x ${rh} cm` };
    }
    return { h: mH, I: mI, A: mA, label: 'Manual' };
  }, [secMode, presetId, rb, rh, mA, mI, mH]);

  const inp: BeamInput = useMemo(
    () => ({
      L,
      supports,
      hinges: hinges.map((h) => h.x),
      lineLoads,
      pointLoads,
      moments,
      E: material.E,
      I: section.I,
      A: section.A,
    }),
    [L, supports, hinges, lineLoads, pointLoads, moments, material.E, section.I, section.A],
  );
  const r = useMemo(() => analyzeBeam(inp), [inp]);

  const hint = stabilityHint(supports, hinges.length, L);
  const design = useMemo(() => {
    if (!r.ok) return null;
    const Mmax = Math.max(Math.abs(r.maxM.value), Math.abs(r.minM.value));
    const spanEff = effectiveSpan(supports.map((s) => s.x), L);
    const args = {
      Mmax,
      deflMax: Math.abs(r.maxDefl.value),
      spanEff,
      kind: material.kind,
      strength: material.strength,
      h: section.h,
      I: section.I,
      limitDen,
    };
    const res = checkBeam(args);
    const suggestion =
      res.overall === 'gagal' && material.kind === 'steel'
        ? suggestSteelSection({ ...args, I: section.I })
        : null;
    return { res, suggestion, spanEff };
  }, [r, supports, L, material.kind, material.strength, section.h, section.I, limitDen]);

  const typeName = { pin: 'Sendi', roller: 'Rol', fixed: 'Jepit' };
  const sel = { padding: 4 };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 740 }}>
      <h1>Analisis Struktur Balok</h1>

      <div style={{ ...box, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Field label="Panjang total L (m)" value={L} onChange={setL} />
      </div>

      <div style={box}>
        <b>Bahan dan penampang</b>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column' }}>
            Bahan
            <select value={matId} style={sel} onChange={(e) => setMatId(e.target.value)}>
              {MATERIALS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          {base.kind === 'custom' && (
            <>
              <Field label="E (GPa)" value={customE} onChange={setCustomE} />
              <Field label="Tegangan ijin lentur (MPa)" value={customAllow} onChange={setCustomAllow} />
            </>
          )}
          <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column' }}>
            Bentuk penampang
            <select value={secMode} style={sel} onChange={(e) => setSecMode(e.target.value as 'iwf' | 'rect' | 'manual')}>
              <option value="iwf">Profil IWF (baja)</option>
              <option value="rect">Persegi (beton/kayu)</option>
              <option value="manual">Manual (A, I, tinggi)</option>
            </select>
          </label>
          {secMode === 'iwf' && (
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column' }}>
              Profil
              <select value={presetId} style={sel} onChange={(e) => setPresetId(e.target.value)}>
                {STEEL_SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
          {secMode === 'rect' && (
            <>
              <Field label="Lebar b (cm)" value={rb} onChange={setRb} />
              <Field label="Tinggi h (cm)" value={rh} onChange={setRh} />
            </>
          )}
          {secMode === 'manual' && (
            <>
              <Field label="A (cm²)" value={mA} onChange={setMA} />
              <Field label="I (cm⁴)" value={mI} onChange={setMI} />
              <Field label="Tinggi h (cm)" value={mH} onChange={setMH} />
            </>
          )}
          <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column' }}>
            Batas lendutan
            <select value={limitDen} style={sel} onChange={(e) => setLimitDen(Number(e.target.value))}>
              <option value={180}>bentang/180 (atap)</option>
              <option value={240}>bentang/240</option>
              <option value={360}>bentang/360 (lantai)</option>
              <option value={480}>bentang/480 (ketat)</option>
            </select>
          </label>
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
          {section.label}: A = {section.A.toFixed(2)} cm², I = {section.I.toFixed(0)} cm⁴, h = {section.h} cm. E ={' '}
          {material.E.toFixed(1)} GPa, tegangan lentur ijin = {allowableBending(material).toFixed(1)} MPa. {base.note}
        </div>
      </div>

      <SupportRows items={supports} onChange={setSupports} />
      <NumRows
        title="Sendi gerber"
        items={hinges}
        fields={[{ key: 'x', label: 'x (m)' }]}
        make={() => ({ x: L / 2 })}
        onChange={setHinges}
      />
      <NumRows
        title="Beban merata / segitiga / trapesium (kN/m, + ke bawah). w1 = awal, w2 = akhir"
        items={lineLoads}
        fields={[
          { key: 'x1', label: 'x awal (m)' },
          { key: 'x2', label: 'x akhir (m)' },
          { key: 'w1', label: 'w awal' },
          { key: 'w2', label: 'w akhir' },
        ]}
        make={() => ({ x1: 0, x2: L, w1: 10, w2: 10 })}
        onChange={setLineLoads}
      />
      <NumRows
        title="Beban titik (kN, + ke bawah)"
        items={pointLoads}
        fields={[
          { key: 'x', label: 'x (m)' },
          { key: 'P', label: 'P (kN)' },
        ]}
        make={() => ({ x: L / 2, P: 10 })}
        onChange={setPointLoads}
      />
      <NumRows
        title="Momen terpusat (kNm, + searah jarum jam ↻)"
        items={moments}
        fields={[
          { key: 'x', label: 'x (m)' },
          { key: 'M', label: 'M (kNm)' },
        ]}
        make={() => ({ x: L / 2, M: 10 })}
        onChange={setMoments}
      />

      {!r.ok ? (
        <>
          <BeamView input={inp} />
          <div
            style={{
              border: `2px solid ${colors.gagal.border}`,
              background: colors.gagal.bg,
              color: colors.gagal.text,
              borderRadius: 6,
              padding: 12,
              marginTop: 10,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>GAGAL: STRUKTUR TIDAK STABIL (MEKANISME)</div>
            <p style={{ margin: '6px 0' }}>
              Ini bukan karena beban terlalu besar, tetapi karena <b>susunan tumpuannya</b>: struktur bisa bergerak
              atau berputar bebas sehingga tidak ada keseimbangan.
            </p>
            {hint.message && <p style={{ margin: '6px 0' }}>{hint.message}</p>}
            {r.error && <p style={{ margin: '6px 0', fontSize: 13 }}>Detail: {r.error}</p>}
            <div style={{ fontSize: 13 }}>
              <b>Cara mengatasi:</b>
              <ul style={{ margin: '4px 0' }}>
                <li>Sendi + rol di kedua ujung (balok sederhana).</li>
                <li>Atau satu tumpuan jepit di salah satu ujung (kantilever).</li>
                <li>Kalau memakai sendi gerber, tambahkan satu penahan lagi untuk tiap sendi.</li>
              </ul>
            </div>
            {hint.canAddRoller && (
              <button onClick={() => setSupports([...supports, { x: L, type: 'roller' }])}>
                Perbaiki otomatis: tambah rol di x = {L} m
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {design && (
            <div
              style={{
                border: `2px solid ${colors[design.res.overall].border}`,
                background: colors[design.res.overall].bg,
                color: colors[design.res.overall].text,
                borderRadius: 6,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {design.res.overall === 'aman' && 'BERHASIL: struktur stabil dan memenuhi pengecekan'}
                {design.res.overall === 'gagal' && 'GAGAL: struktur stabil tetapi TIDAK memenuhi pengecekan'}
                {design.res.overall === 'perlu' && 'PERLU DESAIN LANJUT: stabil, namun butuh tulangan'}
              </div>
              <div style={{ fontSize: 13, margin: '2px 0 8px' }}>
                {material.name}, {section.label}
              </div>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '2px 6px' }}>Pengecekan</th>
                    <th style={{ padding: '2px 6px' }}>Hasil</th>
                    <th style={{ padding: '2px 6px' }}>Batas</th>
                    <th style={{ padding: '2px 6px' }}>Rasio</th>
                    <th style={{ padding: '2px 6px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {design.res.items.map((it) => (
                    <tr key={it.name} style={{ borderTop: '1px solid #0002' }}>
                      <td style={{ padding: '3px 6px' }}>{it.name}</td>
                      <td style={{ padding: '3px 6px' }}>{it.value}</td>
                      <td style={{ padding: '3px 6px' }}>{it.limit}</td>
                      <td style={{ padding: '3px 6px' }}>{(it.ratio * 100).toFixed(0)}%</td>
                      <td style={{ padding: '3px 6px', fontWeight: 700 }}>
                        {it.status === 'ok' ? 'AMAN' : it.status === 'fail' ? 'GAGAL' : 'PERLU TULANGAN'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {design.res.items.map(
                (it) =>
                  it.note && (
                    <p key={it.name} style={{ fontSize: 12, margin: '6px 0 0' }}>
                      {it.note}
                    </p>
                  ),
              )}
              {design.suggestion && (
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  <b>Saran:</b> profil terkecil yang memenuhi untuk beban ini adalah{' '}
                  <b>{design.suggestion.name}</b>. Pilih profil itu pada bentuk penampang IWF. Berat sendiri balok
                  belum dihitung, jadi tambahkan sebagai beban merata.
                </p>
              )}
              {design.res.overall === 'gagal' && !design.suggestion && (
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  <b>Saran:</b> perbesar penampang (tinggi h berpengaruh paling besar), pakai bahan lebih kuat,
                  perpendek bentang, atau tambah tumpuan.
                </p>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 11 }}>
                Pengecekan sederhana: hanya tegangan lentur dan lendutan elastis, memakai beban yang kamu masukkan
                apa adanya (tanpa faktor beban dan tanpa berat sendiri). Geser, tekuk lateral, sambungan, dan
                ketentuan SNI belum dicek. Wajib diverifikasi insinyur berlisensi.
              </p>
            </div>
          )}

          <BeamView input={inp} xs={r.xs} defl={r.defl} animate={animate} />
          <label style={{ fontSize: 13, display: 'block', margin: '6px 0' }}>
            <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />{' '}
            Animasikan lendutan
          </label>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>
            Garis merah putus-putus = bentuk lendutan (diperbesar agar terlihat). Lingkaran putih = sendi gerber.
            Animasi hanya efek tampilan, hasil hitungan tetap statis.
          </p>

          <h3>Reaksi tumpuan</h3>
          <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>x (m)</th>
                <th>Jenis</th>
                <th>Ry (kN, ↑ +)</th>
                <th>Mz (kNm, ↻ +)</th>
              </tr>
            </thead>
            <tbody>
              {r.supports.map((s, k) => (
                <tr key={k}>
                  <td>{s.x}</td>
                  <td>{typeName[s.type]}</td>
                  <td>{(s.Ry / 1000).toFixed(3)}</td>
                  <td>{(s.Mz / 1000).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13 }}>
            Cek keseimbangan: ΣRy = <b>{(r.sumRy / 1000).toFixed(3)} kN</b>, total beban ={' '}
            <b>{(r.totalLoad / 1000).toFixed(3)} kN</b>
          </p>

          <h3>Nilai maksimum</h3>
          <ul style={{ fontSize: 13 }}>
            <li>
              Momen positif maks: <b>{(r.maxM.value / 1000).toFixed(3)} kNm</b> di x = {r.maxM.x.toFixed(2)} m
            </li>
            <li>
              Momen negatif maks: <b>{(r.minM.value / 1000).toFixed(3)} kNm</b> di x = {r.minM.x.toFixed(2)} m
            </li>
            <li>
              Geser maks (nilai mutlak): <b>{(Math.abs(r.maxV.value) / 1000).toFixed(3)} kN</b> di x ={' '}
              {r.maxV.x.toFixed(2)} m
            </li>
            <li>
              Lendutan maks: <b>{(Math.abs(r.maxDefl.value) * 1000).toFixed(3)} mm</b> di x ={' '}
              {r.maxDefl.x.toFixed(2)} m
            </li>
          </ul>

          <DiagramChart
            title="SFD (gaya geser)"
            unit="kN"
            xs={r.diagram.x}
            ys={r.diagram.V.map((v) => v / 1000)}
            L={inp.L}
            color="#1a56db"
          />
          <DiagramChart
            title="BMD (momen lentur, sisi tarik di bawah)"
            unit="kNm"
            xs={r.diagram.x}
            ys={r.diagram.M.map((v) => v / 1000)}
            L={inp.L}
            color="#7c3aed"
            flip
          />
          <DiagramChart
            title="Lendutan"
            unit="mm"
            xs={r.xs}
            ys={r.defl.map((d) => d * 1000)}
            L={inp.L}
            color="#e02424"
          />
          <DeflectionQuery
            xs={r.xs}
            L={inp.L}
            series={[{ label: 'Lendutan vertikal', values: r.defl.map((d) => d * 1000) }]}
          />
          <ForceQuery
            xs={r.diagram.x}
            L={inp.L}
            series={[
              { label: 'Geser V', unit: 'kN', values: r.diagram.V.map((v) => v / 1000) },
              { label: 'Momen M', unit: 'kNm', values: r.diagram.M.map((v) => v / 1000) },
            ]}
          />
        </>
      )}
    </div>
  );
}
