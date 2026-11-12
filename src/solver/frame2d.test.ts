import { describe, it, expect } from 'vitest';
import { solveFrame } from './frame2d';

describe('balok sederhana', () => {
  it('lendutan tengah bentang = PL^3/48EI', () => {
    const E = 200e9, I = 1e-4, A = 0.01, P = 10000, L = 4;
    const nodes = [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: L / 2, y: 0 },
      { id: 3, x: L, y: 0 },
    ];
    const members = [
      { id: 1, nodeI: 1, nodeJ: 2, E, A, I },
      { id: 2, nodeI: 2, nodeJ: 3, E, A, I },
    ];
    const supports = [
      { node: 1, fixX: true, fixY: true, fixRot: false },
      { node: 3, fixX: false, fixY: true, fixRot: false },
    ];
    const loads = [{ node: 2, fx: 0, fy: -P, mz: 0 }];

    const { u } = solveFrame(nodes, members, supports, loads);
    const expected = -(P * L ** 3) / (48 * E * I); // ≈ -6.667e-4 m
    expect(u[4]).toBeCloseTo(expected, 8);
  });
});