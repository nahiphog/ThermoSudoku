import { expect, it } from 'vitest';
import { blank, DEFAULT_GENERATION, generationError, validatePuzzle } from './puzzle';
import { generateDetailed } from './generator';

it('validates the extended lengths and preserves the no-givens setting', () => {
  for (const length of [12, 13, 14]) {
    const p = { ...blank('slow'), symmetricThermos: false, thermometerCount: 1, minThermoLength: length, noGivens: true };
    expect(validatePuzzle(p)).toMatchObject({ minThermoLength: length, noGivens: true });
    expect(generationError('slow', p)).toBeNull();
    expect(generationError('thermo', p)).toContain('at most 9');
  }
  const old = blank(); delete old.noGivens;
  expect(validatePuzzle(old).noGivens).toBe(false);
  expect(() => validatePuzzle({ ...old, noGivens: 'true' })).toThrow();
  expect(() => validatePuzzle({ ...old, minThermoLength: 15 })).toThrow();
});
it('rejects rotationally symmetric zero-clue generation before starting', () => {
  const options = { ...DEFAULT_GENERATION, noGivens: true };
  expect(generationError('thermo', options)).toContain('symmetry');
  expect(() => generateDetailed('thermo', options)).toThrow(/symmetry/);
});
it('never returns a nonunique zero-clue puzzle or silently retains givens', () => {
  let seed = 7;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const stages: number[] = [];
  // One short thermometer cannot uniquely determine an otherwise empty Sudoku.
  expect(() => generateDetailed('thermo', { ...DEFAULT_GENERATION, symmetricThermos: false, thermometerCount: 1, minThermoLength: 2, logicalOnly: false, noGivens: true }, p => stages.push(p.stage), random, 500)).toThrow(/budget/);
  expect(stages).toContain(4);
  expect(stages).not.toContain(6);
});
