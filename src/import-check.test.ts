import { expect, it } from 'vitest';
import { checkImported, parseImport } from './import-check';
import { example } from './puzzle';
import { encodePuzzle } from './puzzle-string';

it('extracts an embedded puzzle token preserving variant and ordered paths', () => {
  const p = example(); p.variant = 'slow';
  const restored = parseImport(`Here is my puzzle:\n${encodePuzzle(p)}\nPlease check it.`);
  expect(restored.thermos).toEqual(p.thermos); expect(restored.givens).toEqual(p.givens); expect(restored.variant).toBe('slow');
  expect(() => parseImport(`${encodePuzzle(p)} ${encodePuzzle(p)}`)).toThrow('one puzzle');
  expect(() => parseImport('123')).toThrow();
});
it('checks a unique imported puzzle and records its complete walkthrough', () => {
  const p = parseImport(example().givens.join('').replaceAll('0', '.'));
  const r = checkImported(p);
  expect(r.exhausted).toBe(true); expect(r.solutions).toHaveLength(1);
  expect(r.analysis!.frames.at(-1)!.values).toEqual(r.solutions[0]);
});
it('distinguishes contradictory and inconclusive imports', () => {
  const p = example(); p.givens[1] = p.values[1] = 5;
  expect(checkImported(p)).toMatchObject({ exhausted: true, solutions: [] });
  expect(checkImported(example(), 0)).toMatchObject({ exhausted: false, solutions: [] });
});
it('returns two different valid solutions for an ambiguous import', () => {
  const completed = checkImported(example()).solutions[0];
  const p = parseImport(completed.map(d => d === 1 || d === 2 ? 0 : d).join(''));
  const r = checkImported(p);
  expect(r.solutions).toHaveLength(2); expect(r.solutions[0]).not.toEqual(r.solutions[1]);
  expect(r.analysis).toBeUndefined();
});
