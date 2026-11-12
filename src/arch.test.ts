import { describe, it, expect } from 'vitest';
import { analyzeArch, type ArchInput } from './solver/arch';

const base: ArchInput = {
  L: 10,
  f: 2,
  n: 40,
  type: 'threeHinged',
  wH: 10,
  x1: 0,
  x2: 10,
  wArc: 0,
  pointLoads: [],
  E: 25,
  I: 720000,
  A: 2400,
};

function run(p: Partial<ArchInput>) {
  const r = analyzeArch({ ...base, ...p });
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('busur lingkaran', () => {
  it('tiga sendi, w=10 kN/m, L=10, f=2: Ry=50 kN, H=wL²/8f=62.5 kN, M puncak=0', () => {
    const r = run({});
    expect(r.supports[0].Ry).toBeCloseTo(50000, -1);
    expect(r.supports[1].Ry).toBeCloseTo(50000, -1);
    expect(r.supports[0].Rx).toBeCloseTo(62500, -1);
    expect(r.supports[1].Rx).toBeCloseTo(-62500, -1);
    const i = r.diagram.x.findIndex((x) => Math.abs(x - 5) < 1e-6);
    expect(r.diagram.M[i]).toBeCloseTo(0, -1);
  });

  it('dua sendi dan jepit-jepit: simetris, Ry=wL/2, Rx kiri = -Rx kanan', () => {
    for (const type of ['twoHinged', 'fixed'] as const) {
      const r = run({ type });
      expect(r.supports[0].Ry).toBeCloseTo(50000, -1);
      expect(r.supports[0].Rx + r.supports[1].Rx).toBeCloseTo(0, -1);
      expect(r.supports[0].Rx).toBeGreaterThan(0);
    }
  });

  it('keseimbangan dengan beban titik vertikal dan horizontal', () => {
    const r = run({ type: 'twoHinged', wH: 0, pointLoads: [{ x: 3, P: 20, H: 10 }] });
    expect(r.sumRy).toBeCloseTo(r.totalV, -1);
    expect(r.sumRx).toBeCloseTo(-r.totalH, -1);
  });
});