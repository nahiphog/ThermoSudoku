import { expect, it } from 'vitest';
import { drawLayout, generate, hasOverlap, rotatePath } from './generator';
import { blank, generationError, validatePuzzle } from './puzzle';
const seeded = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
it('draws exact lengths without shortening or overlapping paths', () => {
  for (const symmetric of [false, true]) {
    const lengths = symmetric ? [4, 5, 4, 5] : [4, 4, 4, 5];
    const random = seeded(5);
    const paths = drawLayout(symmetric, random, 6, 3, 9, lengths)!;
    expect(paths).not.toBeNull();
    expect(paths.map(t => t.length).sort()).toEqual([...lengths].sort());
    expect(hasOverlap(paths)).toBe(false);
    if (symmetric) for (const path of paths) expect(paths).toContainEqual(rotatePath(path));
  }
});
it('rejects impossible lengths and symmetry combinations', () => {
  const p = blank();
  expect(generationError('thermo', { ...p, thermoLengths: [4, 4, 4, 5] })).toMatch(/even/);
  expect(generationError('thermo', { ...p, symmetricThermos: false, thermoLengths: [4, 4, 4, 5] })).toBeNull();
  for (const lengths of [[], [1], [2.5], [15], Array(10).fill(9)]) expect(generationError('slow', { ...p, thermoLengths: lengths })).not.toBeNull();
  expect(generationError('thermo', { ...p, thermoLengths: [10, 10] })).toMatch(/at most 9/);
  expect(() => validatePuzzle({ ...p, thermoLengths: [2.5] })).toThrow();
});
it('preserves exact lengths through generation and saved puzzle validation', () => {
  const p = generate('thermo', true, seeded(7), 30000, { ...blank(), symmetricThermos: false, logicalOnly: false, thermoLengths: [4, 4, 4, 5] });
  expect(p.thermos.map(t => t.length)).toEqual([4, 4, 4, 5]);
  expect(p.thermometerCount).toBe(4);
  expect(validatePuzzle(p).thermoLengths).toEqual([4, 4, 4, 5]);
}, 35000);
