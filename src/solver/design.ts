// Pilihan bahan, penampang, dan pengecekan sederhana (tegangan lentur + lendutan) untuk balok.
// Pengecekan ini ELASTIS dan SEDERHANA. Hasilnya bukan pengganti desain sesuai SNI.

export type MaterialKind = 'steel' | 'concrete' | 'wood' | 'custom';

export type Material = {
  id: string;
  name: string;
  kind: MaterialKind;
  E: number; // GPa
  strength: number; // MPa. baja: fy, beton: fc', kayu: tegangan lentur ijin, kustom: tegangan ijin
  note: string;
};

export const MATERIALS: Material[] = [
  { id: 'bj37', name: 'Baja BJ 37 (fy 240 MPa)', kind: 'steel', E: 200, strength: 240, note: 'Tegangan ijin = fy / 1.5' },
  { id: 'bj41', name: 'Baja BJ 41 (fy 250 MPa)', kind: 'steel', E: 200, strength: 250, note: 'Tegangan ijin = fy / 1.5' },
  { id: 'bj50', name: 'Baja BJ 50 (fy 290 MPa)', kind: 'steel', E: 200, strength: 290, note: 'Tegangan ijin = fy / 1.5' },
  { id: 'bj55', name: 'Baja BJ 55 (fy 410 MPa)', kind: 'steel', E: 200, strength: 410, note: 'Tegangan ijin = fy / 1.5' },
  { id: 'fc20', name: "Beton fc' 20 MPa", kind: 'concrete', E: 4.7 * Math.sqrt(20), strength: 20, note: "E = 4700 √fc'. Batas retak fr = 0.62 √fc'" },
  { id: 'fc25', name: "Beton fc' 25 MPa", kind: 'concrete', E: 4.7 * Math.sqrt(25), strength: 25, note: "E = 4700 √fc'. Batas retak fr = 0.62 √fc'" },
  { id: 'fc30', name: "Beton fc' 30 MPa", kind: 'concrete', E: 4.7 * Math.sqrt(30), strength: 30, note: "E = 4700 √fc'. Batas retak fr = 0.62 √fc'" },
  { id: 'fc35', name: "Beton fc' 35 MPa", kind: 'concrete', E: 4.7 * Math.sqrt(35), strength: 35, note: "E = 4700 √fc'. Batas retak fr = 0.62 √fc'" },
  { id: 'kayu1', name: 'Kayu kelas kuat I (indikatif)', kind: 'wood', E: 12.3, strength: 14.7, note: 'Nilai indikatif PKKI 1961. Sesuaikan dengan jenis kayu sebenarnya.' },
  { id: 'kayu2', name: 'Kayu kelas kuat II (indikatif)', kind: 'wood', E: 9.8, strength: 9.8, note: 'Nilai indikatif PKKI 1961. Sesuaikan dengan jenis kayu sebenarnya.' },
  { id: 'kayu3', name: 'Kayu kelas kuat III (indikatif)', kind: 'wood', E: 7.8, strength: 7.4, note: 'Nilai indikatif PKKI 1961. Sesuaikan dengan jenis kayu sebenarnya.' },
  { id: 'custom', name: 'Kustom (isi sendiri)', kind: 'custom', E: 200, strength: 160, note: 'Isi E dan tegangan ijin sesuai data bahan.' },
];

export type SectionPreset = { id: string; name: string; h: number; I: number; A: number }; // h cm, I cm4, A cm2

// Profil IWF (nilai tabel baja JIS, sumbu kuat). Cek ulang dengan tabel pemasok sebelum dipakai.
export const STEEL_SECTIONS: SectionPreset[] = [
  { id: 'iwf200', name: 'IWF 200x100x5.5x8', h: 20, I: 1840, A: 27.16 },
  { id: 'iwf250', name: 'IWF 250x125x6x9', h: 25, I: 4050, A: 37.66 },
  { id: 'iwf300', name: 'IWF 300x150x6.5x9', h: 30, I: 7210, A: 46.78 },
  { id: 'iwf400', name: 'IWF 400x200x8x13', h: 40, I: 23700, A: 84.12 },
  { id: 'iwf500', name: 'IWF 500x200x10x16', h: 50, I: 47800, A: 114.2 },
];

export function rectSection(b: number, h: number) {
  // b, h dalam cm
  return { h, I: (b * h ** 3) / 12, A: b * h };
}

// Tegangan lentur ijin (MPa)
export function allowableBending(m: { kind: MaterialKind; strength: number }) {
  if (m.kind === 'steel') return m.strength / 1.5;
  if (m.kind === 'concrete') return 0.62 * Math.sqrt(m.strength); // modulus retak fr
  return m.strength;
}

// Bentang efektif untuk batas lendutan: bentang terpanjang antar tumpuan, atau 2x panjang kantilever
export function effectiveSpan(supportX: number[], L: number) {
  const s = [...supportX].sort((a, b) => a - b);
  if (s.length === 0) return L;
  let span = 0;
  for (let i = 0; i < s.length - 1; i++) span = Math.max(span, s[i + 1] - s[i]);
  span = Math.max(span, 2 * s[0], 2 * (L - s[s.length - 1]));
  return span > 0 ? span : L;
}

export type Status = 'ok' | 'fail' | 'warn';
export type CheckItem = {
  name: string;
  value: string;
  limit: string;
  ratio: number;
  status: Status;
  note?: string;
};
export type DesignResult = {
  overall: 'aman' | 'gagal' | 'perlu';
  items: CheckItem[];
  sigma: number; // MPa
  allow: number; // MPa
};

export type CheckInput = {
  Mmax: number; // N·m, nilai mutlak momen terbesar
  deflMax: number; // m, nilai mutlak lendutan terbesar
  spanEff: number; // m
  kind: MaterialKind;
  strength: number; // MPa
  h: number; // cm, tinggi penampang
  I: number; // cm4
  limitDen: number; // batas lendutan = bentang / limitDen
};

export function checkBeam(p: CheckInput): DesignResult {
  const c = p.h / 200; // m, jarak serat terluar (penampang simetris)
  const sigma = (Math.abs(p.Mmax) * c) / (p.I * 1e-8) / 1e6; // MPa
  const allow = allowableBending(p);
  const items: CheckItem[] = [];

  const rb = sigma / allow;
  const bendStatus: Status = rb <= 1 ? 'ok' : p.kind === 'concrete' ? 'warn' : 'fail';
  items.push({
    name: p.kind === 'concrete' ? 'Tegangan tarik lentur terhadap batas retak' : 'Tegangan lentur',
    value: `${sigma.toFixed(1)} MPa`,
    limit: `${allow.toFixed(1)} MPa`,
    ratio: rb,
    status: bendStatus,
    note:
      p.kind === 'concrete' && rb > 1
        ? 'Penampang akan retak. Balok beton perlu dihitung dengan tulangan (belum tersedia di aplikasi ini).'
        : undefined,
  });

  const lim = p.spanEff / p.limitDen;
  const rd = p.deflMax / lim;
  items.push({
    name: `Lendutan (batas bentang/${p.limitDen})`,
    value: `${(p.deflMax * 1000).toFixed(2)} mm`,
    limit: `${(lim * 1000).toFixed(2)} mm`,
    ratio: rd,
    status: rd <= 1 ? 'ok' : 'fail',
    note:
      p.kind === 'concrete'
        ? 'Beton bertulang yang retak dan mengalami rangkak bisa melendut 2 sampai 3 kali lebih besar dari hitungan elastis ini.'
        : undefined,
  });

  const overall = items.some((i) => i.status === 'fail') ? 'gagal' : items.some((i) => i.status === 'warn') ? 'perlu' : 'aman';
  return { overall, items, sigma, allow };
}

// Saran profil baja terkecil yang memenuhi tegangan dan lendutan (beban tidak diubah, berat sendiri tidak dihitung)
export function suggestSteelSection(
  p: Pick<CheckInput, 'Mmax' | 'deflMax' | 'spanEff' | 'strength' | 'limitDen'> & { I: number },
): SectionPreset | null {
  const sorted = [...STEEL_SECTIONS].sort((a, b) => a.I - b.I);
  for (const s of sorted) {
    const d = p.deflMax * (p.I / s.I); // lendutan berbanding terbalik dengan I
    const r = checkBeam({ ...p, kind: 'steel', h: s.h, I: s.I, deflMax: d });
    if (r.overall === 'aman') return s;
  }
  return null;
}

// Analisis penyebab struktur tidak stabil, untuk pesan yang jelas
export type SupportKind = 'pin' | 'roller' | 'fixed';
export function stabilityHint(supports: { x: number; type: SupportKind }[], hingeCount: number, L: number) {
  const restraint = supports.reduce((n, s) => n + (s.type === 'pin' ? 2 : s.type === 'roller' ? 1 : 3), 0);
  const needed = 3 + hingeCount;
  const msgs: string[] = [];
  if (supports.length === 0) msgs.push('Belum ada tumpuan.');
  else if (restraint < needed)
    msgs.push(
      `Jumlah penahan = ${restraint}, minimal ${needed} (3 ditambah 1 untuk tiap sendi gerber). Sendi menahan 2, rol 1, jepit 3.`,
    );
  const canAddRoller = supports.length > 0 && !supports.some((s) => Math.abs(s.x - L) < 1e-6);
  return { restraint, needed, message: msgs.join(' '), canAddRoller };
}
