import { expect, it } from 'vitest';
import { generateDetailed, hasOverlap } from './generator';
import { blank, DEFAULT_GENERATION, validatePuzzle } from './puzzle';
import { solve } from './solver';

function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
it('defaults older puzzles to unrestricted generation and validates the setting', () => {
  const p = blank(); delete p.logicalOnly;
  expect(validatePuzzle(p).logicalOnly).toBe(false);
  expect(() => validatePuzzle({ ...p, logicalOnly: 'yes' })).toThrow();
});
for (const variant of ['thermo', 'slow'] as const) it(`generates a minimal unique ${variant} with a complete logic-only walkthrough`, () => {
  const r = generateDetailed(variant, { ...DEFAULT_GENERATION, logicalOnly: true }, () => {}, seeded(7), 30000);
  expect(r.puzzle.logicalOnly).toBe(true);
  expect(r.analysis.guesses).toBe(0); expect(r.analysis.backtracks).toBe(0);
  expect(r.analysis.techniques['Brute force']).toBeUndefined();
  expect(r.analysis.frames.some(f => f.kind === 'guess')).toBe(false);
  expect(r.analysis.frames.at(-1)!.values).toEqual(r.solution);
  expect(hasOverlap(r.puzzle.thermos)).toBe(false);
  expect(r.puzzle.thermos.flat().every(c => !r.puzzle.givens[c])).toBe(true);
  expect(solve(r.puzzle).solutions).toEqual([r.solution]);
  for (let c = 0; c <= 40; c++) {
    expect(!!r.puzzle.givens[c]).toBe(!!r.puzzle.givens[80 - c]);
    if (!r.puzzle.givens[c]) continue;
    const p = structuredClone(r.puzzle);
    p.values[c] = p.givens[c] = p.values[80 - c] = p.givens[80 - c] = 0;
    expect(solve(p, 10000).solutions).toHaveLength(2);
  }
}, 40000);
