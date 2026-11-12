import { expect, it } from 'vitest';
import { blank, DEFAULT_GENERATION, example, generationError } from './puzzle';
import { decodePuzzle, encodePuzzle } from './puzzle-string';
import { drawLayout, generate, hasOverlap } from './generator';
import { solve } from './solver';

function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
it('round trips clues, both variants and ordered paths without entries or solution', () => {
  for (const variant of ['thermo', 'slow'] as const) {
    const p = example(); p.variant = variant; p.values[2] = 4;
    const restored = decodePuzzle(encodePuzzle(p));
    expect(restored.givens).toEqual(p.givens); expect(restored.values).toEqual(p.givens);
    expect(restored.thermos).toEqual(p.thermos); expect(restored.variant).toBe(variant);
  }
  expect(decodePuzzle(encodePuzzle(blank())).thermos).toEqual([]);
});
it('rejects malformed strings and disconnected or repeated path cells', () => {
  const prefix = `TS1|T|${'0'.repeat(81)}|`;
  for (const path of ['1100', '1199', '1111', '111', '']) {
    if (path) expect(() => decodePuzzle(prefix + path)).toThrow();
  }
  expect(() => decodePuzzle(prefix.replace('TS1', 'TS2'))).toThrow();
});
it('explains impossible selections before attempting generation', () => {
  expect(generationError('thermo', {...DEFAULT_GENERATION, minThermoLength: 10})).toContain('at most 9');
  expect(generationError('slow', {...DEFAULT_GENERATION, thermometerCount: 30})).toContain('81');
  expect(generationError('thermo', {...DEFAULT_GENERATION, thermometerCount: 1})).toContain('even');
  expect(generationError('slow', {...DEFAULT_GENERATION, thermometerCount: 2, minThermoLength: 11})).toBeNull();
});
it('draws exact custom counts with minimum lengths including long Slow Thermos', () => {
  for (const [count, length] of [[1, 2], [4, 5], [2, 11], [1, 12], [1, 13], [1, 14], [30, 2]]) {
    const random = seeded(7); let paths: number[][] | null = null;
    for (let i = 0; i < 100 && !paths; i++) paths = drawLayout(false, random, count, length);
    expect(paths).not.toBeNull(); expect(paths!.length).toBe(count);
    expect(paths!.every(t => t.length >= length)).toBe(true); expect(hasOverlap(paths!)).toBe(false);
  }
});
it('generates unique puzzles using custom counts and lengths', () => {
  for (const [count, length] of [[1, 2], [4, 4]]) {
    const p = generate('thermo', true, seeded(7), 30000, {...DEFAULT_GENERATION, symmetricThermos: false, thermometerCount: count, minThermoLength: length});
    expect(p.thermos.length).toBe(count); expect(p.thermos.every(t => t.length >= length)).toBe(true);
    const result = solve(p); expect(result.exhausted).toBe(true); expect(result.solutions).toHaveLength(1);
  }
}, 65000);
