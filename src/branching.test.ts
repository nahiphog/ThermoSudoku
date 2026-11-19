import { expect, it } from 'vitest';
import { blank, generationError, sharedBulb, validatePuzzle } from './puzzle';
import { drawBranchingLayout, generateDetailed, hasBranchOverlap, rotatePath } from './generator';
import { fastSolve, validCompletion } from './fast-solver';
import { solve } from './solver';
import { analyze } from './walkthrough';
import { encodePuzzle, decodePuzzle } from './puzzle-string';
import { parseImport } from './import-check';
import { thermometerMarkup } from './grid-markup';
import { buildCustom } from './custom-builder';

const solution = [...'534678912672195348198342567859761423426853791713924856961537284287419635345286179'].map(Number);
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

it('keeps Missing Thermometer branches on one hidden bulb and rejects independent directions', () => {
  const p = blank('missing'); p.branching = true; p.thermos = [[1, 0], [1, 2]]; p.givens = [...solution]; p.values = [...solution];
  expect(solve(p).solutions).toEqual([solution]); expect(fastSolve(p).solutions).toEqual([solution]);
  const analysis = analyze(p);
  expect(analysis.techniques['Bulb finding']).toBe(1);
  expect(analysis.frames.find(f => f.kind === 'bulb')!.bulbEnds).toEqual([1, 1]);
  expect(thermometerMarkup(p, Array(81).fill(0))).not.toContain('<circle');
  expect(thermometerMarkup(p, solution).match(/<circle/g)).toHaveLength(1);
  p.thermos = [[0, 1], [0, 9]]; // 5→3 and 5→6 are individually valid missing paths, but have different bulbs.
  expect(validCompletion(solution, p.thermos, 'missing', true)).toBe(false);
  expect(solve(p).solutions).toHaveLength(0); expect(fastSolve(p).solutions).toHaveLength(0);
  p.branching = false;
  expect(solve(p).solutions).toEqual([solution]); expect(fastSolve(p).solutions).toEqual([solution]);
});

it('preserves shared-bulb rules in JSON, TS2 tokens and embedded imports', () => {
  const p = blank('missing'); p.branching = true; p.thermos = [[1, 0], [1, 2]];
  const token = encodePuzzle(p); expect(token).toMatch(/^TS2\|M\|/);
  for (const restored of [decodePuzzle(token), parseImport(`Puzzle: ${token}`), validatePuzzle(JSON.parse(JSON.stringify(p)))]) {
    expect(restored.branching).toBe(true); expect(restored.thermos).toEqual(p.thermos);
  }
  expect(() => validatePuzzle({ ...p, branching: 'yes' })).toThrow();
});

it.each([false, true])('draws branch groups with exact lengths and symmetry=%s', symmetric => {
  const lengths = symmetric ? [3, 3, 4, 4, 5, 5] : [3, 4, 5];
  const paths = drawBranchingLayout(symmetric, seeded(7), lengths.length, 3, 9, lengths)!;
  expect(paths).not.toBeNull(); expect(paths.map(t => t.length).sort()).toEqual([...lengths].sort());
  expect(paths.every(t => sharedBulb(paths, t, true))).toBe(true);
  expect(hasBranchOverlap(paths)).toBe(false);
  if (symmetric) for (const path of paths) expect(paths).toContainEqual(rotatePath(path));
});

it.each(['thermo', 'slow', 'missing'] as const)('generates and builds shared-bulb %s puzzles with certified solutions', variant => {
  const options = { ...blank(variant), branching: true, symmetricThermos: false, logicalOnly: true, thermoLengths: [3, 3] };
  const result = generateDetailed(variant, options, () => {}, seeded(17), 15000);
  expect(result.puzzle.branching).toBe(true);
  expect(result.puzzle.thermos[0][0]).toBe(result.puzzle.thermos[1][0]);
  expect(validCompletion(result.solution, result.puzzle.thermos, variant, true)).toBe(true);
  expect(solve(result.puzzle, 10000).solutions).toEqual([result.solution]);
  const custom = buildCustom(result.puzzle, () => {}, seeded(19));
  expect(custom.puzzle.branching).toBe(true); expect(custom.puzzle.thermos).toEqual(result.puzzle.thermos);
  expect(fastSolve(custom.puzzle).solutions).toEqual([custom.solution]);
}, 30000);

it('rejects impossible branch counts and accepts shared bulbs when counting occupied cells', () => {
  expect(generationError('thermo', { ...blank(), branching: true, thermoLengths: [3, 3] })).toContain('four');
  expect(generationError('thermo', { ...blank(), branching: true, symmetricThermos: false, thermoLengths: Array(10).fill(9) })).not.toContain('exact');
});

it('checks uniqueness rather than adding clues for clue-free Missing branches', () => {
  const p = blank('missing'); p.branching = true; p.noGivens = true; p.thermos = [[1, 0], [1, 2]];
  expect(() => buildCustom(p, () => {}, seeded(5))).toThrow('more than one solution without given cells');
  expect(p.givens).toEqual(Array(81).fill(0));
});

it.each([2, 3, 4, 5, 6, 7, 8])('draws exactly %s branches at every bulb, with and without symmetry', branches => {
  for (const symmetric of [false, true]) {
    const count = branches * (symmetric ? 2 : 1);
    const paths = drawBranchingLayout(symmetric, seeded(11), count, 2, 9, Array(count).fill(2), branches)!;
    expect(paths).not.toBeNull(); expect(paths).toHaveLength(count);
    expect(hasBranchOverlap(paths)).toBe(false);
    for (const root of new Set(paths.map(t => t[0]))) expect(paths.filter(t => t[0] === root)).toHaveLength(branches);
    if (symmetric) for (const path of paths) expect(paths).toContainEqual(rotatePath(path));
  }
});

it('validates fixed branch groups, capacity and saved settings', () => {
  const options = { ...blank(), branching: true, branchesPerBulb: 4, symmetricThermos: false, thermoLengths: [3, 3, 3, 3] };
  expect(generationError('thermo', options)).toBeNull();
  expect(generationError('thermo', { ...options, symmetricThermos: true })).toContain('multiple of 8');
  expect(generationError('thermo', { ...options, thermoLengths: [3, 3, 3] })).toContain('multiple of 4');
  expect(generationError('thermo', { ...options, branching: false })).toBeNull();
  expect(validatePuzzle(JSON.parse(JSON.stringify(options))).branchesPerBulb).toBe(4);
  for (const n of [1, 9, 2.5, NaN]) {
    expect(generationError('thermo', { ...options, branchesPerBulb: n })).toContain('2–8');
    expect(() => validatePuzzle({ ...options, branchesPerBulb: n })).toThrow('2–8');
    expect(drawBranchingLayout(false, seeded(1), 4, 3, 9, undefined, n)).toBeNull();
  }
});

it.each(['thermo', 'slow', 'missing'] as const)('generates certified %s puzzles with four branches per bulb', variant => {
  const options = { ...blank(variant), branching: true, branchesPerBulb: 4, symmetricThermos: false, thermoLengths: [3, 3, 3, 3] };
  const result = generateDetailed(variant, options, () => {}, seeded(21), 15000);
  expect(result.puzzle.branchesPerBulb).toBe(4);
  expect(result.puzzle.thermos).toHaveLength(4);
  expect(new Set(result.puzzle.thermos.map(t => t[0])).size).toBe(1);
  expect(validCompletion(result.solution, result.puzzle.thermos, variant, true)).toBe(true);
  expect(result.analysis.frames.at(-1)!.values).toEqual(result.solution);
  const verified = fastSolve(result.puzzle);
  expect(verified.exhausted).toBe(true); expect(verified.solutions).toEqual([result.solution]);
}, 30000);
