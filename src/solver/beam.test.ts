import { describe, it, expect } from 'vitest';
import { analyzeBeam, type BeamInput } from './beam';

const base: BeamInput = {
  L: 8,
  supports: [],
  hinges: [],
  lineLoads: [],
  pointLoads: [],
  moments: [],
  E: 200,
  I: 10000,
  A: 100,
};

function run(inp: Partial<BeamInput>) {
  const r = analyzeBeam({ ...base, ...inp });
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('balok', () => {
  it('kantilever: P=10 kN di ujung, L=4 -> M=-PL dan lendutan PL³/3EI', () => {
    const r = run({ L: 4, supports: [{ x: 0, type: 'fixed' }], pointLoads: [{ x: 4, P: 10 }] });
    expect(r.supports[0].Ry).toBeCloseTo(10000, 0);
    expect(r.minM.value).toBeCloseTo(-40000, 0);
    expect(Math.abs(r.maxDefl.value)).toBeCloseTo(0.0106667, 6);
  });

  it('menerus 2 bentang 4 m, w=10: reaksi 18.75 / 50 / 18.75 kN, M tumpuan tengah -20 kNm', () => {
    const r = run({
      supports: [{ x: 0, type: 'pin' }, { x: 4, type: 'roller' }, { x: 8, type: 'roller' }],
      lineLoads: [{ x1: 0, x2: 8, w1: 10, w2: 10 }],
    });
    expect(r.supports[0].Ry).toBeCloseTo(15000, 0);
    expect(r.supports[1].Ry).toBeCloseTo(50000, 0);
    expect(r.minM.value).toBeCloseTo(-20000, 0);
  });

  it('beban segitiga 0 -> 12 kN/m, L=6: reaksi 12 kN dan 24 kN, Mmaks ≈ 27.7 kNm', () => {
    const r = run({
      L: 6,
      supports: [{ x: 0, type: 'pin' }, { x: 6, type: 'roller' }],
      lineLoads: [{ x1: 0, x2: 6, w1: 0, w2: 12 }],
    });
    expect(r.supports[0].Ry).toBeCloseTo(12000, 0);
    expect(r.supports[1].Ry).toBeCloseTo(24000, 0);
    expect(r.maxM.value).toBeCloseTo(27713, -2);
  });

  it('overhang: tumpuan di 0 dan 4, P=10 kN di ujung x=6 -> reaksi -5 dan 15 kN, M=-20 kNm', () => {
    const r = run({
      L: 6,
      supports: [{ x: 0, type: 'pin' }, { x: 4, type: 'roller' }],
      pointLoads: [{ x: 6, P: 10 }],
    });
    expect(r.supports[0].Ry).toBeCloseTo(-5000, 0);
    expect(r.supports[1].Ry).toBeCloseTo(15000, 0);
    expect(r.minM.value).toBeCloseTo(-20000, 0);
  });

  it('gerber: sendi di x=2 -> reaksi 10 / 60 / 10 kN, M tumpuan -40 kNm, M di sendi = 0', () => {
    const r = run({
      supports: [{ x: 0, type: 'pin' }, { x: 4, type: 'roller' }, { x: 8, type: 'roller' }],
      hinges: [2],
      lineLoads: [{ x1: 0, x2: 8, w1: 10, w2: 10 }],
    });
    expect(r.supports[0].Ry).toBeCloseTo(10000, 0);
    expect(r.supports[1].Ry).toBeCloseTo(60000, 0);
    expect(r.supports[2].Ry).toBeCloseTo(10000, 0);
    expect(r.minM.value).toBeCloseTo(-40000, 0);
    const iH = r.diagram.x.findIndex((x) => Math.abs(x - 2) < 1e-6);
    expect(r.diagram.M[iH]).toBeCloseTo(0, 0);
  });

  it('mendeteksi mekanisme: sendi sederhana + sendi gerber di tengah', () => {
    const r = analyzeBeam({
      ...base,
      supports: [{ x: 0, type: 'pin' }, { x: 8, type: 'roller' }],
      hinges: [4],
      lineLoads: [{ x1: 0, x2: 8, w1: 10, w2: 10 }],
    });
    expect(r.ok).toBe(false);
  });
});