import { describe, it, expect } from 'vitest';
import { checkBeam, effectiveSpan, stabilityHint, suggestSteelSection, MATERIALS, STEEL_SECTIONS } from './design';

describe('pengecekan bahan', () => {
  it('baja IWF 300, balok sederhana 6 m, w=10: sigma ≈ 93.6 MPa, lendutan ≈ 11.7 mm, AMAN', () => {
    const s = STEEL_SECTIONS.find((x) => x.id === 'iwf300')!;
    const E = 200e9;
    const deflMax = (5 * 10e3 * 6 ** 4) / (384 * E * s.I * 1e-8);
    const r = checkBeam({ Mmax: 45e3, deflMax, spanEff: 6, kind: 'steel', strength: 240, h: s.h, I: s.I, limitDen: 360 });
    expect(r.sigma).toBeCloseTo(93.6, 0);
    expect(deflMax * 1000).toBeCloseTo(11.7, 0);
    expect(r.overall).toBe('aman');
  });

  it('baja IWF 200, bentang 8 m, w=20: sigma sangat besar, GAGAL, dan ada saran profil', () => {
    const s = STEEL_SECTIONS[0];
    const M = (20e3 * 64) / 8;
    const deflMax = (5 * 20e3 * 8 ** 4) / (384 * 200e9 * s.I * 1e-8);
    const r = checkBeam({ Mmax: M, deflMax, spanEff: 8, kind: 'steel', strength: 240, h: s.h, I: s.I, limitDen: 360 });
    expect(r.overall).toBe('gagal');
    const sug = suggestSteelSection({ Mmax: M, deflMax, spanEff: 8, strength: 240, limitDen: 360, I: s.I });
    expect(sug).not.toBe(null);
    expect(sug!.I).toBeGreaterThan(s.I);
  });

  it('beton: tegangan melebihi retak memberi status perlu tulangan, bukan gagal', () => {
    const r = checkBeam({ Mmax: 60e3, deflMax: 0.001, spanEff: 5, kind: 'concrete', strength: 25, h: 40, I: (25 * 40 ** 3) / 12, limitDen: 360 });
    expect(r.overall).toBe('perlu');
  });

  it('bentang efektif: kantilever jepit tunggal = 2L, dan menjulur = 2x julur', () => {
    expect(effectiveSpan([0], 4)).toBeCloseTo(8, 6);
    expect(effectiveSpan([0, 4], 6)).toBeCloseTo(4, 6);
    expect(effectiveSpan([0, 3], 6)).toBeCloseTo(6, 6);
  });

  it('tumpuan hanya satu sendi: penahan 2, kurang dari 3', () => {
    const h = stabilityHint([{ x: 0, type: 'pin' }], 0, 8);
    expect(h.restraint).toBe(2);
    expect(h.canAddRoller).toBe(true);
    expect(MATERIALS.length).toBeGreaterThan(5);
  });
});
