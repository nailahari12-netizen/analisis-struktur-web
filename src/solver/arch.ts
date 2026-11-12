import { solveFrame, memberDiagram } from './frame2d';
import type { Node, Member, Support, NodalLoad, MemberLoad } from './types';

export type ArchType = 'twoHinged' | 'fixed' | 'threeHinged';
// P (kN, + ke bawah), H (kN, + ke kanan), x = posisi horizontal dari tumpuan kiri
export type ArchPointLoad = { x: number; P: number; H: number };

export type ArchInput = {
  L: number; // bentang (m)
  f: number; // tinggi busur / rise (m), 0 < f <= L/2
  n: number; // jumlah segmen (genap)
  type: ArchType;
  wH: number; // beban merata per proyeksi horizontal (kN/m, + ke bawah)
  x1: number; // awal beban wH (m)
  x2: number; // akhir beban wH (m)
  wArc: number; // beban merata per panjang busur / berat sendiri (kN/m, + ke bawah)
  pointLoads: ArchPointLoad[];
  E: number; // GPa
  I: number; // cm4
  A: number; // cm2
};

type Peak = { value: number; x: number };

export type ArchResult =
  | { ok: false; error: string }
  | {
      ok: true;
      radius: number;
      arcLength: number;
      nodes: { x: number; y: number }[];
      u: number[]; // perpindahan (m, rad), 3 per node
      supports: { label: string; x: number; Rx: number; Ry: number; Mz: number }[]; // N, N, Nm
      diagram: { x: number[]; N: number[]; V: number[]; M: number[] }; // N dan Nm
      maxM: Peak;
      minM: Peak;
      minN: Peak;
      maxV: Peak;
      totalV: number; // N, + ke bawah
      totalH: number; // N, + ke kanan
      sumRx: number;
      sumRy: number;
    };

function peak(xs: number[], ys: number[], better: (a: number, b: number) => boolean): Peak {
  let k = 0;
  ys.forEach((v, i) => {
    if (better(v, ys[k])) k = i;
  });
  return { value: ys[k], x: xs[k] };
}

export function analyzeArch(inp: ArchInput): ArchResult {
  const { L, f } = inp;
  if (!(L > 0)) return { ok: false, error: 'Bentang L harus lebih besar dari 0.' };
  if (!(f > 0 && f <= L / 2))
    return { ok: false, error: 'Tinggi busur f harus lebih dari 0 dan paling besar L/2 (setengah lingkaran).' };
  if (!(inp.E > 0 && inp.I > 0 && inp.A > 0))
    return { ok: false, error: 'E, I, dan A harus lebih besar dari 0.' };
  const n = 2 * Math.round(inp.n / 2);
  if (n < 4 || n > 120) return { ok: false, error: 'Jumlah segmen harus antara 4 dan 120.' };
  if (inp.wH !== 0 && !(inp.x1 >= 0 && inp.x2 <= L && inp.x2 > inp.x1))
    return { ok: false, error: 'Beban merata: x awal harus lebih kecil dari x akhir, dan keduanya di antara 0 dan L.' };
  if (!inp.pointLoads.every((p) => p.x >= 0 && p.x <= L))
    return { ok: false, error: 'Posisi beban titik harus di antara 0 dan L.' };

  // Geometri busur lingkaran
  const R = (L * L) / 4 + f * f;
  const radius = R / (2 * f);
  const yc = f - radius; // pusat lingkaran
  const alpha = Math.atan2(L / 2, radius - f); // setengah sudut busur
  const nodes: Node[] = [];
  for (let k = 0; k <= n; k++) {
    const th = -alpha + (2 * alpha * k) / n;
    let x = L / 2 + radius * Math.sin(th);
    let y = yc + radius * Math.cos(th);
    if (k === 0) { x = 0; y = 0; }
    if (k === n) { x = L; y = 0; }
    nodes.push({ id: k + 1, x, y });
  }

  const E = inp.E * 1e9;
  const I = inp.I * 1e-8;
  const A = inp.A * 1e-4;
  const crownMember = n / 2 - 1; // batang yang berakhir di puncak
  const members: Member[] = nodes.slice(0, -1).map((nd, i) => ({
    id: i + 1,
    nodeI: nd.id,
    nodeJ: nodes[i + 1].id,
    E,
    A,
    I,
    releaseJ: inp.type === 'threeHinged' && i === crownMember,
  }));

  const supports: Support[] = [nodes[0].id, nodes[n].id].map((id) => ({
    node: id,
    fixX: true,
    fixY: true,
    fixRot: inp.type === 'fixed',
  }));

  // Beban titik: dipindahkan ke node terdekat
  const loads: NodalLoad[] = inp.pointLoads.map((p) => {
    let best = nodes[0];
    for (const nd of nodes) if (Math.abs(nd.x - p.x) < Math.abs(best.x - p.x)) best = nd;
    return { node: best.id, fx: p.H * 1000, fy: -p.P * 1000, mz: 0 };
  });

  // Beban merata: w per panjang batang = wH * cos(sudut) + wArc
  const memberLoads: MemberLoad[] = [];
  let totalV = inp.pointLoads.reduce((s, p) => s + p.P, 0) * 1000;
  const totalH = inp.pointLoads.reduce((s, p) => s + p.H, 0) * 1000;
  let arcLength = 0;
  for (const m of members) {
    const a = nodes[m.nodeI - 1];
    const b = nodes[m.nodeJ - 1];
    const Lm = Math.hypot(b.x - a.x, b.y - a.y);
    const c = (b.x - a.x) / Lm;
    const mid = (a.x + b.x) / 2;
    arcLength += Lm;
    const wHere = (inp.wH !== 0 && mid > inp.x1 && mid < inp.x2 ? inp.wH * c : 0) + inp.wArc;
    if (wHere !== 0) {
      memberLoads.push({ member: m.id, w: wHere * 1000 });
      totalV += wHere * 1000 * Lm;
    }
  }

  let res;
  try {
    res = solveFrame(nodes, members, supports, loads, memberLoads);
  } catch {
    return { ok: false, error: 'Perhitungan gagal. Periksa input.' };
  }
  if (!res.stable || !res.u.every(Number.isFinite))
    return { ok: false, error: 'Struktur tidak stabil. Periksa jenis tumpuan.' };

  // Diagram gaya dalam, diplot terhadap posisi horizontal
  const diagram = { x: [] as number[], N: [] as number[], V: [] as number[], M: [] as number[] };
  res.memberResults.forEach((r, k) => {
    const x0 = nodes[k].x;
    for (const p of memberDiagram(r, 3)) {
      diagram.x.push(x0 + p.x * r.c);
      diagram.N.push(p.N);
      diagram.V.push(p.V);
      diagram.M.push(p.M);
    }
  });

  const reaction = (i: number, label: string) => ({
    label,
    x: nodes[i].x,
    Rx: res.reactions[3 * i],
    Ry: res.reactions[3 * i + 1],
    Mz: -res.reactions[3 * i + 2],
  });
  const sup = [reaction(0, 'Kiri'), reaction(n, 'Kanan')];

  let sumRx = 0;
  let sumRy = 0;
  nodes.forEach((_, i) => {
    sumRx += res.reactions[3 * i];
    sumRy += res.reactions[3 * i + 1];
  });

  return {
    ok: true,
    radius,
    arcLength,
    nodes: nodes.map((nd) => ({ x: nd.x, y: nd.y })),
    u: res.u,
    supports: sup,
    diagram,
    maxM: peak(diagram.x, diagram.M, (a, b) => a > b),
    minM: peak(diagram.x, diagram.M, (a, b) => a < b),
    minN: peak(diagram.x, diagram.N, (a, b) => a < b),
    maxV: peak(diagram.x, diagram.V.map(Math.abs), (a, b) => a > b),
    totalV,
    totalH,
    sumRx,
    sumRy,
  };
}