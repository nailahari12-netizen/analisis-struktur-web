import { Matrix, solve, EigenvalueDecomposition } from 'ml-matrix';
import type { Node, Member, Support, NodalLoad, MemberLoad } from './types';

function localK(E: number, A: number, I: number, L: number): number[][] {
  const a = (E * A) / L;
  const b = (12 * E * I) / L ** 3;
  const c = (6 * E * I) / L ** 2;
  const d = (4 * E * I) / L;
  const e = (2 * E * I) / L;
  return [
    [a, 0, 0, -a, 0, 0],
    [0, b, c, 0, -b, c],
    [0, c, d, 0, -c, e],
    [-a, 0, 0, a, 0, 0],
    [0, -b, -c, 0, b, -c],
    [0, c, e, 0, -c, d],
  ];
}

function rotation(c: number, s: number) {
  return new Matrix([
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1],
  ]);
}

// Beban merata/segitiga/trapesium (w1 di ujung i, w2 di ujung j, N/m, + ke bawah)
// diubah menjadi gaya ekuivalen di ujung batang (sumbu lokal)
function equivalentLocal(w1: number, w2: number, c: number, s: number, L: number): number[] {
  const qx1 = -w1 * s;
  const qx2 = -w2 * s;
  const qy1 = -w1 * c;
  const qy2 = -w2 * c;
  return [
    (L * (2 * qx1 + qx2)) / 6,
    (L * (7 * qy1 + 3 * qy2)) / 20,
    (L * L * (3 * qy1 + 2 * qy2)) / 60,
    (L * (qx1 + 2 * qx2)) / 6,
    (L * (3 * qy1 + 7 * qy2)) / 20,
    -(L * L * (2 * qy1 + 3 * qy2)) / 60,
  ];
}

// Sendi di ujung batang: momen di DOF d dibuat nol (static condensation)
function release(k: Matrix, f: number[], d: number) {
  const kk = k.clone();
  const ff = f.slice();
  const kdd = k.get(d, d);
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 6; b++) kk.set(a, b, k.get(a, b) - (k.get(a, d) * k.get(d, b)) / kdd);
    ff[a] = f[a] - (k.get(a, d) * f[d]) / kdd;
  }
  for (let a = 0; a < 6; a++) {
    kk.set(d, a, 0);
    kk.set(a, d, 0);
  }
  ff[d] = 0;
  return { k: kk, f: ff };
}

export type MemberResult = {
  id: number;
  L: number;
  c: number;
  s: number;
  w1: number;
  w2: number;
  end: number[]; // gaya ujung lokal [Ni, Vi, Mi, Nj, Vj, Mj]
};

export type FrameResult = {
  u: number[];
  reactions: number[];
  memberResults: MemberResult[];
  stable: boolean;
};

export function solveFrame(
  nodes: Node[],
  members: Member[],
  supports: Support[],
  loads: NodalLoad[],
  memberLoads: MemberLoad[] = [],
): FrameResult {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const ndof = nodes.length * 3;
  const K = Matrix.zeros(ndof, ndof);
  const F = Matrix.zeros(ndof, 1);

  const elems = members.map((m) => {
    const i = idx.get(m.nodeI)!;
    const j = idx.get(m.nodeJ)!;
    const dx = nodes[j].x - nodes[i].x;
    const dy = nodes[j].y - nodes[i].y;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const T = rotation(c, s);
    let kl = new Matrix(localK(m.E, m.A, m.I, L));
    const qs = memberLoads.filter((q) => q.member === m.id);
    const w1 = qs.reduce((sum, q) => sum + q.w, 0);
    const w2 = qs.reduce((sum, q) => sum + (q.w2 ?? q.w), 0);
    let fl = equivalentLocal(w1, w2, c, s, L);
    if (m.releaseI) {
      const r = release(kl, fl, 2);
      kl = r.k;
      fl = r.f;
    }
    if (m.releaseJ) {
      const r = release(kl, fl, 5);
      kl = r.k;
      fl = r.f;
    }
    const dofs = [3 * i, 3 * i + 1, 3 * i + 2, 3 * j, 3 * j + 1, 3 * j + 2];
    return { m, L, c, s, w1, w2, T, kl, fl, dofs };
  });

  // Rakit matriks kekakuan global dan beban ekuivalen
  for (const e of elems) {
    const kg = e.T.transpose().mmul(e.kl).mmul(e.T);
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++)
        K.set(e.dofs[a], e.dofs[b], K.get(e.dofs[a], e.dofs[b]) + kg.get(a, b));

    const fg = e.T.transpose().mmul(Matrix.columnVector(e.fl)).to1DArray();
    e.dofs.forEach((d, k) => F.set(d, 0, F.get(d, 0) + fg[k]));
  }

  // Beban nodal
  for (const l of loads) {
    const i = idx.get(l.node)!;
    F.set(3 * i, 0, F.get(3 * i, 0) + l.fx);
    F.set(3 * i + 1, 0, F.get(3 * i + 1, 0) + l.fy);
    F.set(3 * i + 2, 0, F.get(3 * i + 2, 0) + l.mz);
  }

  // Tumpuan
  const fixed = new Set<number>();
  for (const s of supports) {
    const i = idx.get(s.node)!;
    if (s.fixX) fixed.add(3 * i);
    if (s.fixY) fixed.add(3 * i + 1);
    if (s.fixRot) fixed.add(3 * i + 2);
  }
  const free = Array.from({ length: ndof }, (_, k) => k).filter((k) => !fixed.has(k));

  // Cek kestabilan: matriks dinormalkan dulu, lalu nilai eigen terkecil harus > 0
  if (free.length > 0) {
    const Kff = K.selection(free, free);
    const dg = free.map((_, k) => Kff.get(k, k));
    const unstable = {
      u: new Array(ndof).fill(0),
      reactions: new Array(ndof).fill(0),
      memberResults: [],
      stable: false,
    };
    if (dg.some((v) => !(v > 0))) return unstable;
    const Ks = Matrix.zeros(free.length, free.length);
    for (let a = 0; a < free.length; a++)
      for (let b = 0; b < free.length; b++)
        Ks.set(a, b, Kff.get(a, b) / Math.sqrt(dg[a] * dg[b]));
    const ev = new EigenvalueDecomposition(Ks, { assumeSymmetric: true }).realEigenvalues;
    if (!(Math.min(...ev) > 1e-9)) return unstable;
  }

  // Selesaikan K·u = F pada DOF bebas
  const u = new Array(ndof).fill(0);
  if (free.length > 0) {
    const uf = solve(K.selection(free, free), F.selection(free, [0]));
    free.forEach((dof, k) => (u[dof] = uf.get(k, 0)));
  }

  // Reaksi = K·u - F
  const R = K.mmul(Matrix.columnVector(u)).sub(F).to1DArray();

  // Gaya ujung tiap batang (sumbu lokal)
  const memberResults: MemberResult[] = elems.map((e) => {
    const dl = e.T.mmul(Matrix.columnVector(e.dofs.map((d) => u[d]))).to1DArray();
    const end = e.kl
      .mmul(Matrix.columnVector(dl))
      .to1DArray()
      .map((v, k) => v - e.fl[k]);
    return { id: e.m.id, L: e.L, c: e.c, s: e.s, w1: e.w1, w2: e.w2, end };
  });

  return { u, reactions: R, memberResults, stable: true };
}

// Gaya dalam sepanjang satu batang: N (tarik +), V (geser), M (sagging/momen lapangan +)
export function memberDiagram(r: MemberResult, nPts = 21) {
  const qx1 = -r.w1 * r.s;
  const qx2 = -r.w2 * r.s;
  const qy1 = -r.w1 * r.c;
  const qy2 = -r.w2 * r.c;
  const pts: { x: number; N: number; V: number; M: number }[] = [];
  for (let k = 0; k < nPts; k++) {
    const x = (r.L * k) / (nPts - 1);
    const Nx = qx1 * x + ((qx2 - qx1) * x * x) / (2 * r.L);
    const Vy = qy1 * x + ((qy2 - qy1) * x * x) / (2 * r.L);
    const My = (qy1 * x * x) / 2 + ((qy2 - qy1) * x * x * x) / (6 * r.L);
    pts.push({
      x,
      N: -r.end[0] - Nx,
      V: r.end[1] + Vy,
      M: r.end[1] * x + My - r.end[2],
    });
  }
  return pts;
}