import { expect, it } from 'vitest';
import { blank, generationError, validatePuzzle } from './puzzle';
import { ALL_CANDS, bit } from './vendor/sudokui/board';
import { missingSupports, displayBulbs } from './missing-thermometer';
import { conflicts, solve } from './solver';
import { fastSolve, validCompletion } from './fast-solver';
import { analyze } from './walkthrough';
import { generateDetailed } from './generator';
import { decodePuzzle, encodePuzzle } from './puzzle-string';
import { parseImport } from './import-check';
import { thermometerMarkup } from './grid-markup';

const solution = [...'534678912672195348198342567859761423426853791713924856961537284287419635345286179'].map(Number);
function fixture() {
  const p = blank('missing'); p.thermos = [[0, 1], [7, 8, 17]];
  p.givens = [...solution]; for (const c of p.thermos.flat()) p.givens[c] = 0;
  p.values = [...p.givens]; return p;
}
it('supports both whole-path directions without permitting a direction change midway', () => {
  const domains = new Uint16Array(81).fill(ALL_CANDS), path = [0, 1, 2];
  expect(missingSupports(domains, path).union).toEqual([ALL_CANDS, 254, ALL_CANDS]);
  domains[0] = bit(5); domains[1] = bit(3); domains[2] = bit(1);
  expect(missingSupports(domains, path).forward).toBeNull();
  expect(missingSupports(domains, path).reverse).toEqual([bit(5), bit(3), bit(1)]);
  domains[2] = bit(4);
  expect(missingSupports(domains, path).union).toEqual([0, 0, 0]);
});
it('both solvers accept either orientation and reject a non-monotonic full path', () => {
  const p = fixture();
  expect(conflicts(p).size).toBe(0);
  expect(solve(p).solutions).toEqual([solution]);
  expect(fastSolve(p).solutions).toEqual([solution]);
  expect(validCompletion(solution, p.thermos, 'missing')).toBe(true);
  p.thermos = p.thermos.map(t => [...t].reverse());
  expect(fastSolve(p).solutions).toEqual([solution]);
  expect(solve(p).solutions).toEqual([solution]);
  p.values = [...solution]; p.givens = [...solution]; p.thermos = [[0, 1, 2]];
  expect(validCompletion(solution, p.thermos, 'missing')).toBe(false);
  expect(solve(p).solutions).toHaveLength(0);
  expect(fastSolve(p).solutions).toHaveLength(0);
});
it('does not mistake uniqueness with a known bulb for Missing Thermometer uniqueness', () => {
  const p = blank('missing');
  p.givens = solution.map(d => d <= 2 ? 0 : d); p.values = [...p.givens];
  p.thermos = [[7, 8]];
  expect(solve(p).solutions).toHaveLength(2);
  expect(fastSolve(p).solutions).toHaveLength(2);
  p.variant = 'thermo';
  expect(fastSolve(p).solutions).toHaveLength(1);
});
it('records each discovered bulb, charges 10 each, and reveals only bulbs known at that frame', () => {
  const p = fixture(), analysis = analyze(p);
  const steps = analysis.frames.filter(f => f.kind === 'bulb');
  expect(analysis.techniques['Bulb finding']).toBe(2);
  expect(steps).toHaveLength(2);
  expect(steps[0].description).toContain('r1c2');
  expect(steps[1].description).toContain('r1c8');
  expect(analysis.frames[0].bulbEnds).toEqual([null, null]);
  expect(steps[0].bulbEnds).toEqual([1, null]);
  expect(steps[1].bulbEnds).toEqual([1, 7]);
  expect(analysis.frames.at(-1)!.values).toEqual(solution);
  const strict = { ...p, variant: 'thermo' as const, thermos: [[1, 0], [7, 8, 17]] };
  expect(analysis.score).toBe(analyze(strict).score + 20);
  expect(analyze(strict).techniques['Bulb finding']).toBeUndefined();
  expect(thermometerMarkup(p, p.givens)).not.toContain('<circle');
  expect(thermometerMarkup(p, steps[0].values, steps[0].bulbEnds).match(/<circle/g)).toHaveLength(1);
  expect(displayBulbs(p, solution)).toEqual([1, 7]);
});
it('round-trips Missing Thermometer through puzzle strings, embedded imports, and JSON', () => {
  const p = fixture(), text = encodePuzzle(p);
  expect(text).toMatch(/^TS1\|M\|/);
  expect(decodePuzzle(text)).toMatchObject({ variant: 'missing', thermos: p.thermos, givens: p.givens });
  expect(parseImport(`Puzzle: ${text}`)).toMatchObject({ variant: 'missing' });
  expect(validatePuzzle(JSON.parse(JSON.stringify(p)))).toEqual(p);
  expect(generationError('missing', { ...p, noGivens: true })).toContain('10 − d');
  expect(generationError('missing', { ...p, thermoLengths: [10, 10] })).toContain('at most 9');
});
it('generates a unique puzzle verified without assuming its bulb ends', () => {
  let seed = 17; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const result = generateDetailed('missing', { ...blank('missing'), thermoLengths: [3, 3] }, () => {}, random, 30000);
  expect(result.puzzle.variant).toBe('missing');
  expect(result.puzzle.thermos.flat().every(c => !result.puzzle.givens[c])).toBe(true);
  expect(fastSolve(result.puzzle).solutions).toEqual([result.solution]);
  expect(solve(result.puzzle, 10000).solutions).toEqual([result.solution]);
  expect(result.analysis.techniques['Bulb finding']).toBe(2);
  expect(result.analysis.guesses).toBe(0);
}, 40000);
