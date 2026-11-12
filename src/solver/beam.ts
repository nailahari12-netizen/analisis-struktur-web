import { solveFrame, memberDiagram } from './frame2d';
import type { Node, Member, Support, NodalLoad, MemberLoad } from './types';

export type SupportType = 'pin' | 'roller' | 'fixed';
export type BeamSupport = { x: number; type: SupportType };
// Semua posisi dalam m, diukur dari ujung kiri balok
export type LineLoad = { x1: number; x2: number; w1: number; w2: number }; // kN/m, + ke bawah
export type PointLoad = { x: number; P: number }; // kN, + ke bawah
export type MomentLoad = { x: number; M: number }; // kNm, + searah jarum jam

export type BeamInput = {
  L: number; // panjang total balok (termasuk kantilever)
  supports: BeamSupport[];
  hinges: number[]; // posisi sendi gerber
  lineLoads: LineLoad[];
  pointLoads: PointLoad[];
  moments: MomentLoad[];
  E: number; // GPa
  I: number; // cm4
  A: number; // cm2
};

type Peak = { value: number; x: number };

export type BeamResult =
  | { ok: false; error: string }
  | {
      ok: true;
      xs: number[];
      defl: number[]; // m
      supports: { x: number; type: SupportType; Rx: number; Ry: number; Mz: number }[]; // N, N, Nm
      diagram: { x: number[]; N: number[]; V: number[]; M: number[] }; // N dan Nm
      maxDefl: Peak;
      maxM: Peak;
      minM: Peak;
      maxV: Peak;
      totalLoad: number; // N
      sumRy: number; // N
    };

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

function flags(t: SupportType) {
  switch (t) {
    case 'pin':
      return { fixX: true, fixY: true, fixRot: false };
    case 'roller':
      return { fixX: false, fixY: true, fixRot: false };
    default:
      return { fixX: true, fixY: true, fixRot: true };
  }
}

function peak(xs: number[], ys: number[], pick: (a: number, b: number) => boolean): Peak {
  let k = 0;
  ys.forEach((v, i) => {
    if (pick(v, ys[k])) k = i;
  });
  return { value: ys[k], x: xs[k] };
}

export function analyzeBeam(inp: BeamInput): BeamResult {
  const L = inp.L;
  if (!(L > 0)) return { ok: false, error: 'Panjang balok harus lebih besar dari 0.' };
  if (!(inp.E > 0 && inp.I > 0 && inp.A > 0))
    return { ok: false, error: 'E, I, dan A harus lebih besar dari 0.' };
  if (inp.supports.length === 0) return { ok: false, error: 'Tambahkan minimal satu tumpuan.' };

  const inside = (x: number) => x >= 0 && x <= L;
  if (!inp.supports.every((s) => inside(s.x))) return { ok: false, error: 'Posisi tumpuan harus antara 0 dan L.' };
  if (!inp.pointLoads.every((p) => inside(p.x))) return { ok: false, error: 'Posisi beban titik harus antara 0 dan L.' };
  if (!inp.moments.every((m) => inside(m.x))) return { ok: false, error: 'Posisi momen harus antara 0 dan L.' };
  if (!inp.hinges.every((h) => h > 0 && h < L))
    return { ok: false, error: 'Posisi sendi gerber harus di dalam balok (lebih dari 0 dan kurang dari L).' };
  if (!inp.lineLoads.every((q) => inside(q.x1) && inside(q.x2) && q.x2 > q.x1))
    return { ok: false, error: 'Beban merata/segitiga: x awal harus lebih kecil dari x akhir, dan di dalam balok.' };

  // Titik-titik penting yang harus menjadi node
  const list: number[] = [0, L];
  const keyOf = (x: number) => {
    const p = list.find((v) => Math.abs(v - x) < 1e-4);
    if (p !== undefined) return p;
    const v = r6(x);
    list.push(v);
    return v;
  };
  const sup = inp.supports
    .map((s) => ({ x: keyOf(s.x), type: s.type }))
    .sort((a, b) => a.x - b.x);
  for (let k = 1; k < sup.length; k++)
    if (sup[k].x === sup[k - 1].x) return { ok: false, error: 'Dua tumpuan berada di posisi yang sama.' };
  const hingeX = Array.from(new Set(inp.hinges.map(keyOf)));
  const lines = inp.lineLoads.map((q) => ({ ...q, x1: keyOf(q.x1), x2: keyOf(q.x2) }));
  if (!lines.every((q) => q.x2 > q.x1)) return { ok: false, error: 'Rentang beban terlalu pendek.' };
  const pls = inp.pointLoads.map((p) => ({ ...p, x: keyOf(p.x) }));
  const mls = inp.moments.map((m) => ({ ...m, x: keyOf(m.x) }));

  // Mesh: tiap segmen dibagi lagi supaya kurva lendutan halus
  const keys = [...list].sort((a, b) => a - b);
  const hMax = L / 40;
  const px: number[] = [];
  for (let k = 0; k < keys.length - 1; k++) {
    const a = keys[k];
    const b = keys[k + 1];
    const n = Math.max(1, Math.ceil((b - a) / hMax - 1e-9));
    for (let j = 0; j < n; j++) px.push(j === 0 ? a : r6(a + ((b - a) * j) / n));
  }
  px.push(L);

  const nodes: Node[] = px.map((x, i) => ({ id: i + 1, x, y: 0 }));
  const nodeAt = (x: number) => nodes.find((n) => Math.abs(n.x - x) < 1e-6)!;

  const E = inp.E * 1e9;
  const I = inp.I * 1e-8;
  const A = inp.A * 1e-4;
  const members: Member[] = nodes.slice(0, -1).map((n, i) => ({
    id: i + 1,
    nodeI: n.id,
    nodeJ: nodes[i + 1].id,
    E,
    A,
    I,
    releaseJ: hingeX.some((h) => Math.abs(h - nodes[i + 1].x) < 1e-6),
  }));

  // Tumpuan pertama selalu menahan arah horizontal (tidak ada beban horizontal)
  const supports: Support[] = sup.map((s, k) => ({
    node: nodeAt(s.x).id,
    ...flags(s.type),
    fixX: k === 0 ? true : flags(s.type).fixX,
  }));

  const loads: NodalLoad[] = [
    ...pls.map((p) => ({ node: nodeAt(p.x).id, fx: 0, fy: -p.P * 1000, mz: 0 })),
    ...mls.map((m) => ({ node: nodeAt(m.x).id, fx: 0, fy: 0, mz: -m.M * 1000 })),
  ];

  // Beban merata/segitiga/trapesium -> beban linear per batang
  const memberLoads: MemberLoad[] = [];
  for (const m of members) {
    const xa = nodes[m.nodeI - 1].x;
    const xb = nodes[m.nodeJ - 1].x;
    const mid = (xa + xb) / 2;
    for (const q of lines) {
      if (mid > q.x1 && mid < q.x2) {
        const f = (x: number) => q.w1 + ((q.w2 - q.w1) * (x - q.x1)) / (q.x2 - q.x1);
        memberLoads.push({ member: m.id, w: f(xa) * 1000, w2: f(xb) * 1000 });
      }
    }
  }

  let res;
  try {
    res = solveFrame(nodes, members, supports, loads, memberLoads);
  } catch {
    return { ok: false, error: 'Perhitungan gagal. Struktur kemungkinan tidak stabil.' };
  }
  if (!res.stable || !res.u.every(Number.isFinite))
    return {
      ok: false,
      error:
        'Struktur tidak stabil (mekanisme). Tambah/ubah tumpuan, atau kurangi jumlah sendi gerber.',
    };

  // Diagram gaya dalam
  const diagram = { x: [] as number[], N: [] as number[], V: [] as number[], M: [] as number[] };
  res.memberResults.forEach((r, k) => {
    const x0 = nodes[k].x;
    for (const p of memberDiagram(r, 5)) {
      diagram.x.push(x0 + p.x);
      diagram.N.push(p.N);
      diagram.V.push(p.V);
      diagram.M.push(p.M);
    }
  });

  // Reaksi tumpuan (Mz: + searah jarum jam)
  const supportList = sup.map((s) => {
    const i = nodes.findIndex((n) => Math.abs(n.x - s.x) < 1e-6);
    return {
      x: s.x,
      type: s.type,
      Rx: res.reactions[3 * i],
      Ry: res.reactions[3 * i + 1],
      Mz: -res.reactions[3 * i + 2],
    };
  });

  const defl = nodes.map((_, i) => res.u[3 * i + 1]);
  const absDefl = defl.map(Math.abs);
  const maxDefl = peak(px, absDefl, (a, b) => a > b);
  maxDefl.value = defl[px.indexOf(maxDefl.x)];

  let sumRy = 0;
  nodes.forEach((_, i) => (sumRy += res.reactions[3 * i + 1]));

  const totalLoad =
    inp.lineLoads.reduce((s, q) => s + ((q.w1 + q.w2) / 2) * (q.x2 - q.x1), 0) * 1000 +
    inp.pointLoads.reduce((s, p) => s + p.P, 0) * 1000;

  return {
    ok: true,
    xs: px,
    defl,
    supports: supportList,
    diagram,
    maxDefl,
    maxM: peak(diagram.x, diagram.M, (a, b) => a > b),
    minM: peak(diagram.x, diagram.M, (a, b) => a < b),
    maxV: peak(diagram.x, diagram.V.map(Math.abs), (a, b) => a > b),
    totalLoad,
    sumRy,
  };
}