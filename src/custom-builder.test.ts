import { expect, it } from 'vitest';
import { buildCustom } from './custom-builder';
import { blank } from './puzzle';
import { solve } from './solver';
import { validCompletion } from './fast-solver';

function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

it.each(['thermo', 'slow', 'missing'] as const)('builds a unique %s puzzle without changing supplied paths', variant => {
  const input = blank(variant); input.thermos = [[20, 30], [30, 40]];
  const before = structuredClone(input);
  const result = buildCustom(input, () => {}, seeded(43));
  expect(input).toEqual(before);
  expect(result.puzzle.thermos).toEqual(input.thermos);
  expect(result.puzzle.variant).toBe(variant);
  expect(result.puzzle.givens.filter(Boolean).length).toBeLessThan(81);
  expect(result.puzzle.values).toEqual(result.puzzle.givens);
  expect(validCompletion(result.solution, input.thermos, variant)).toBe(true);
  const verified = solve(result.puzzle, 15000);
  expect(verified.exhausted).toBe(true);
  expect(verified.solutions).toEqual([result.solution]);
}, 30000);

it('reports impossible layouts, invalid Slow Thermos and exhausted budgets', () => {
  const p = blank(); p.thermos = [[0, 1], [1, 0]];
  expect(() => buildCustom(p)).toThrow('cannot form a valid puzzle');
  p.variant = 'slow'; p.thermos = [[0, 1]];
  expect(() => buildCustom(p)).toThrow('equal consecutive pair');
  p.variant = 'thermo';
  expect(() => buildCustom(p, () => {}, Math.random, 0)).toThrow('time limit');
  expect(() => buildCustom(blank())).toThrow('at least one');
});
