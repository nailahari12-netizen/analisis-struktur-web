export type Node = { id: number; x: number; y: number };
export type Member = {
  id: number;
  nodeI: number;
  nodeJ: number;
  E: number;
  A: number;
  I: number;
  releaseI?: boolean; // sendi (momen = 0) di ujung i
  releaseJ?: boolean; // sendi (momen = 0) di ujung j
};
export type Support = { node: number; fixX: boolean; fixY: boolean; fixRot: boolean };
export type NodalLoad = { node: number; fx: number; fy: number; mz: number };
// Beban merata pada batang (N/m, + ke bawah): w di ujung i, w2 di ujung j (kalau kosong = w)
export type MemberLoad = { member: number; w: number; w2?: number };