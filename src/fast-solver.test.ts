import { expect, it } from 'vitest';
import { createUniquenessChecker, fastSolve, validCompletion } from './fast-solver';
import { blank, example, type Puzzle } from './puzzle';
import { solve } from './solver';
import { generateDetailed } from './generator';
import { checkLogical } from './logical-runner';
import { analyze, LogicalSolveStalled } from './walkthrough';

function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function compare(p: Puzzle) {
  const before = JSON.stringify(p), reference = solve(p, 15000), fast = fastSolve(p, 15000);
  expect(reference.exhausted).toBe(true); expect(fast.exhausted).toBe(true);
  expect(fast.solutions.length).toBe(reference.solutions.length);
  for (const values of fast.solutions) {
    expect(validCompletion(values, p.thermos, p.variant)).toBe(true);
    expect(p.values.every((d, c) => !d || d === values[c])).toBe(true);
  }
  if (reference.solutions.length === 1) expect(fast.solutions).toEqual(reference.solutions);
  expect(JSON.stringify(p)).toBe(before);
  return fast;
}

it('matches the reference solver on unique, empty, contradictory, overlapping and cyclic puzzles', () => {
  compare(example()); compare(blank());
  const duplicate = example(); duplicate.values[1] = duplicate.givens[1] = 5; compare(duplicate);
  for (const variant of ['thermo', 'slow'] as const) {
    const equal = blank(variant); equal.thermos = [[20, 30]]; equal.givens[20] = equal.values[20] = equal.givens[30] = equal.values[30] = 5; compare(equal);
    const equalCycle = structuredClone(equal); equalCycle.thermos.push([30, 20]); compare(equalCycle);
    const peer = blank(variant); peer.thermos = [[0, 1]]; peer.values[0] = peer.givens[0] = peer.values[1] = peer.givens[1] = 3; compare(peer);
    const cycle = blank(variant); cycle.thermos = [[0, 1], [1, 0]]; compare(cycle);
  }
  const crossing = example(); crossing.thermos = [[7, 8, 17], [8, 17]]; compare(crossing);
  const noRepeat = example(); noRepeat.variant = 'slow'; noRepeat.thermos = [[0, 1]]; compare(noRepeat);
}, 60000);

it('agrees on seeded clue removals and checks alternative solutions without stale candidates', () => {
  for (const variant of ['thermo', 'slow'] as const) for (const seed of [7, 91]) {
    const r = generateDetailed(variant, { ...blank(variant), logicalOnly: false }, () => {}, seeded(seed), 30000);
    const checker = createUniquenessChecker(r.puzzle, r.solution), random = seeded(seed);
    for (const density of [.15, .35, .7, 1]) {
      const p = structuredClone(r.puzzle);
      p.values = p.givens = r.solution.map(d => random() < density ? d : 0);
      const fast = compare(p), result = checker.check(p.givens);
      expect(result.exhausted).toBe(true); expect(result.unique).toBe(fast.solutions.length === 1);
      expect(checker.check(p.givens)).toEqual(result);
    }
    expect(checker.metrics().hits).toBeGreaterThanOrEqual(4);
    expect(checker.check(r.solution, 0, false)).toEqual({ unique: false, exhausted: false });
    expect(checker.check(r.solution)).toEqual({ unique: true, exhausted: true });
    expect(checker.check(Array(81).fill(0), 0)).toEqual({ unique: false, exhausted: false });
    expect(checker.check(Array(81).fill(0)).unique).toBe(false);
    expect(() => checker.check(Array(81).fill(9))).toThrow('reference');
    expect(() => createUniquenessChecker(r.puzzle, Array(81).fill(9))).toThrow('completion');
  }
}, 90000);

it('lightweight logical certification follows exactly the recorded logical solver', () => {
  for (const p of [example(), blank()]) {
    const solved = checkLogical(p);
    if (solved) {
      const a = analyze(p, 15000, false);
      expect(a.guesses).toBe(0); expect(a.frames.at(-1)!.values).toEqual(solved);
    } else expect(() => analyze(p, 15000, false)).toThrow(LogicalSolveStalled);
  }
  expect(() => checkLogical(example(), 0)).toThrow(/budget/);
});

it('keeps all selected generation constraints across a broader seeded sample', () => {
  for (let seed = 20; seed < 32; seed++) {
    const variant = seed % 2 ? 'slow' : 'thermo';
    const count = [2, 4, 6][seed % 3], length = [2, 3, 4][seed % 3];
    const symmetric = seed % 4 < 2;
    const r = generateDetailed(variant, { ...blank(variant), logicalOnly: true, symmetricThermos: symmetric, thermometerCount: count, minThermoLength: length }, () => {}, seeded(seed), 30000);
    expect(r.puzzle.thermos).toHaveLength(count);
    expect(r.puzzle.thermos.every(t => t.length >= length)).toBe(true);
    expect(validCompletion(r.solution, r.puzzle.thermos, variant)).toBe(true);
    expect(r.analysis.guesses).toBe(0);
    expect(r.analysis.frames.at(-1)!.values).toEqual(r.solution);
    expect(r.puzzle.givens.every((d, c) => !!d === !!r.puzzle.givens[80 - c])).toBe(true);
    expect(r.puzzle.thermos.flat().every(c => !r.puzzle.givens[c])).toBe(true);
    if (symmetric) for (const t of r.puzzle.thermos) expect(r.puzzle.thermos).toContainEqual(t.map(c => 80 - c));
    compare(r.puzzle);
  }
}, 90000);
