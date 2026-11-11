import { describe, expect, it } from 'vitest';
import { adjacent, blank, example, validatePuzzle } from './puzzle';
import { candidates, conflicts, hint, solve } from './solver';
import { digitsOf, UNITS } from './vendor/sudokui/board';

describe('Thermo Sudoku', () => {
  it('supports orthogonal and diagonal adjacency without wrapping rows', () => {
    expect(adjacent(0, 10)).toBe(true); expect(adjacent(0, 9)).toBe(true);
    expect(adjacent(8, 9)).toBe(false); expect(adjacent(0, 0)).toBe(false);
  });
  it('validates imported paths and givens', () => {
    for (const t of [[0], [0, 0], [0, 2], [0, 81], [0, 1, 2, 3, 4, 5, 6, 7, 8, 17]]) expect(() => validatePuzzle({ ...blank(), thermos: [t] })).toThrow();
    const p = blank(); p.givens[0] = 1; expect(() => validatePuzzle(p)).toThrow();
    expect(() => validatePuzzle({ ...blank(), thermos: [[0, 10, 20]] })).not.toThrow();
  });
  it('bounds every position and propagates from a fixed middle digit', () => {
    const p = blank(); p.thermos = [[0, 10, 20, 30]];
    let g = candidates(p).grid;
    expect(digitsOf(g.cands[0])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(digitsOf(g.cands[30])).toEqual([4, 5, 6, 7, 8, 9]);
    p.values[20] = 4; g = candidates(p).grid;
    expect(digitsOf(g.cands[0])).toEqual([1, 2]); expect(digitsOf(g.cands[10])).toEqual([2, 3]);
    expect(digitsOf(g.cands[30])).toEqual([5, 6, 7, 8, 9]);
  });
  it('propagates overlapping paths and rejects directed cycles', () => {
    const p = blank(); p.thermos = [[0, 10, 20], [20, 30, 40]];
    expect(digitsOf(candidates(p).grid.cands[0])).toEqual([1, 2, 3, 4, 5]);
    p.thermos = [[0, 10], [10, 0]]; expect(candidates(p).valid).toBe(false); expect(solve(p).solutions).toHaveLength(0);
  });
  it('rejects duplicate digits, decreasing thermos, and insufficient gaps', () => {
    const p = blank(); p.values[0] = p.values[8] = 1; expect(solve(p).solutions).toHaveLength(0);
    p.values = Array(81).fill(0); p.thermos = [[0, 10, 20]]; p.values[0] = 4; p.values[20] = 5;
    expect(conflicts(p).has(0)).toBe(true); expect(candidates(p).valid).toBe(false);
  });
  it('solves the example uniquely and preserves every constraint', () => {
    const p = example(), result = solve(p);
    expect(result.exhausted).toBe(true); expect(result.solutions).toHaveLength(1);
    const s = result.solutions[0];
    for (const unit of UNITS) expect(new Set(unit.map(c => s[c])).size).toBe(9);
    for (const t of p.thermos) for (let i = 1; i < t.length; i++) expect(s[t[i]]).toBeGreaterThan(s[t[i - 1]]);
    p.givens.forEach((d, i) => { if (d) expect(s[i]).toBe(d); });
  });
  it('imports a real sudokUI deduction for hints', () => {
    const h = hint(example()); expect(h).not.toBeNull(); expect(h!.description).toMatch(/Single|House/);
    const p = example(); const s = solve(p).solutions[0];
    h!.values.forEach((d, i) => { if (d) expect(s[i]).toBe(d); });
  });
  it('identifies multiple solutions without claiming uniqueness on timeout', () => {
    expect(solve(blank()).solutions).toHaveLength(2);
    expect(solve(blank(), 0)).toMatchObject({ exhausted: false, solutions: [] });
  });
  it('solves a length-nine thermometer through propagation alone', () => {
    const p = blank(); p.thermos = [[0, 1, 2, 3, 4, 5, 6, 7, 8]];
    const g = candidates(p).grid;
    for (let i = 0; i < 9; i++) expect(digitsOf(g.cands[i])).toEqual([i + 1]);
  });
});
