import { describe, expect, it } from 'vitest';
import { generate, hasOverlap, rotatePath } from './generator';
import { blank, hasRepeatedStep, validatePuzzle } from './puzzle';
import { candidates, conflicts, solve } from './solver';
import { UNITS } from './vendor/sudokui/board';

function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
describe('variants and generation', () => {
  it('migrates old files and rejects unknown options', () => {
    const { variant: _variant, noThermoGivens: _setting, ...legacy } = blank();
    expect(validatePuzzle(legacy)).toMatchObject({ variant: 'thermo', noThermoGivens: true });
    expect(() => validatePuzzle({ ...legacy, variant: 'other' })).toThrow();
    expect(() => validatePuzzle({ ...legacy, noThermoGivens: 'false' })).toThrow();
  });
  it('allows equal non-peer steps only in Slow Thermo', () => {
    const p = blank('slow'); p.thermos = [[20, 30]]; p.values[20] = p.givens[20] = 5; p.values[30] = p.givens[30] = 5;
    expect(conflicts(p).size).toBe(0); expect(candidates(p).valid).toBe(true);
    expect(solve(p).solutions.length).toBeGreaterThan(0);
    p.variant = 'thermo'; expect(candidates(p).valid).toBe(false);
    p.variant = 'slow'; p.values[30] = p.givens[30] = 4; expect(conflicts(p).size).toBe(2);
  });
  it('still prohibits Sudoku duplicates and requires a possible repeat', () => {
    const p = blank('slow'); p.thermos = [[0, 10]]; p.values[0] = p.values[10] = 3;
    expect(conflicts(p).size).toBe(2);
    p.values.fill(0); expect(candidates(p).valid).toBe(false); // These cells share a box; no equal pair is possible.
  });
  for (const variant of ['thermo', 'slow'] as const) for (const seed of [1, 7, 91]) {
    it(`generates a unique ${variant} puzzle without any givens on paths or bulbs (seed ${seed})`, () => {
      const p = generate(variant, true, seeded(seed));
      expect(p.thermos.every(t => t.length >= 3)).toBe(true);
      expect(hasOverlap(p.thermos)).toBe(false);
      for (const t of p.thermos) expect(p.thermos).toContainEqual(rotatePath(t));
      p.givens.forEach((d, c) => expect(!!d).toBe(!!p.givens[80 - c]));
      expect(validatePuzzle(p)).toEqual(p);
      for (const c of p.thermos.flat()) { expect(p.givens[c]).toBe(0); expect(p.values[c]).toBe(0); }
      const r = solve(p); expect(r.exhausted).toBe(true); expect(r.solutions).toHaveLength(1);
      const s = r.solutions[0];
      for (const unit of UNITS) expect(new Set(unit.map(c => s[c])).size).toBe(9);
      for (const t of p.thermos) for (let i = 1; i < t.length; i++) expect(s[t[i]] - s[t[i - 1]]).toBeGreaterThanOrEqual(variant === 'slow' ? 0 : 1);
      if (variant === 'slow') expect(hasRepeatedStep(s, p.thermos)).toBe(true);
    }, 40000);
  }
  it('enforces the prescribed removal and disjoint workflow over legacy flags', () => {
    const p = generate('thermo', false, seeded(5), 30000, { symmetricGivens: false, symmetricThermos: false, noOverlap: false });
    expect(p.noThermoGivens).toBe(true); expect(p.noOverlap).toBe(true); expect(p.symmetricGivens).toBe(true);
    expect(p.thermos.flat().every(c => p.givens[c] === 0)).toBe(true);
    expect(solve(p).solutions).toHaveLength(1);
  }, 40000);
  it('never returns an unverified puzzle on generation timeout', () => {
    expect(() => generate('slow', true, seeded(1), 0)).toThrow(/budget/);
  });
  it('detects shared cells, branching, crossing diagonals and self-crossings', () => {
    expect(hasOverlap([[0, 10, 11], [1, 9, 18]])).toBe(true);
    expect(hasOverlap([[0, 1, 2], [0, 9, 18]])).toBe(true);
    expect(hasOverlap([[0, 10, 1, 9]])).toBe(true);
    expect(hasOverlap([[0, 1, 2], [78, 79, 80]])).toBe(false);
  });
  for (const variant of ['thermo', 'slow'] as const) it('supports asymmetric ' + variant + ' paths while preserving paired digging', () => {
    const p = generate(variant, true, seeded(123), 30000, { symmetricGivens: true, symmetricThermos: false, noOverlap: true });
    expect(p.symmetricThermos).toBe(false);
    expect(p.thermos.length).toBeGreaterThanOrEqual(6);
    expect(p.thermos.every(t => t.length >= 3)).toBe(true);
    expect(hasOverlap(p.thermos)).toBe(false);
    p.givens.forEach((d, c) => expect(!!d).toBe(!!p.givens[80 - c]));
    const result = solve(p); expect(result.exhausted).toBe(true); expect(result.solutions).toHaveLength(1);
  }, 40000);
  it('rejects an entirely strict completed Slow Thermo puzzle', () => {
    const p = generate('thermo', true, seeded(3));
    p.values = solve(p).solutions[0]; p.variant = 'slow';
    expect(hasRepeatedStep(p.values, p.thermos)).toBe(false);
    expect(solve(p).solutions).toHaveLength(0);
  });
});
