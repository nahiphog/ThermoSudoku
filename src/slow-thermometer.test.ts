import { expect, it } from 'vitest';
import { applySlowThermometerBounds } from './slow-thermometer';
import { bit, emptyGrid, gridFromValues, PEERS, setValue } from './vendor/sudokui/board';
import { decodePuzzle } from './puzzle-string';
import { analyze } from './walkthrough';
import { checkLogical } from './logical-runner';
import { fastSolve, validCompletion } from './fast-solver';
import { candidates } from './solver';

const supplied = 'TS1|S|000000000000000000000000004000400000600209007000008000700000000000000000000000000|3142332324;7968778786;9596858483;1514252627;9899887889;1211223221';
it('combines non-consecutive box peers into a strict chain in the supplied puzzle', () => {
  const p = decodePuzzle(supplied), g = gridFromValues(p.givens);
  expect(g.cands[20] & bit(1)).not.toBe(0); expect(g.cands[11] & bit(2)).not.toBe(0);
  expect(applySlowThermometerBounds(g, p.thermos)).toBe(true);
  expect(g.cands[20] & bit(1)).toBe(0);
  expect(g.cands[11] & (bit(1) | bit(2))).toBe(0);
  const propagated = candidates(p); expect(propagated.valid).toBe(true);
  expect(propagated.grid.cands[20] & bit(1)).toBe(0);
});
it('records the named technique, eliminations, explanation, and tallies', () => {
  const p = decodePuzzle(supplied), a = analyze(p, 30000);
  const frame = a.frames.find(f => f.title === 'Slow Thermometer bounds')!;
  expect(frame).toBeDefined();
  expect(frame.eliminations).toContainEqual({ cell: 20, digit: 1 });
  expect(frame.eliminations).toContainEqual({ cell: 11, digit: 2 });
  expect(frame.description).toContain('r3c1 < r3c3');
  expect(frame.description).toContain('r3c3 < r2c3');
  expect(frame.strictInequalities).toContainEqual([18, 20]);
  expect(frame.strictInequalities).toContainEqual([20, 11]);
  expect(frame.strictInequalities!.flat()).not.toContain(28);
  expect(a.frames[0].strictInequalities).toBeUndefined();
  expect(a.frames.at(-1)!.strictInequalities).toBeUndefined();
  expect(a.techniques['Slow Thermometer bounds']).toBeGreaterThan(0);
  for (const [index, step] of a.frames.entries()) {
    if (!step.strictInequalities) continue;
    const edges = step.strictInequalities;
    const chain = [edges[0][0], ...edges.map(e => e[1])];
    expect(new Set(chain).size).toBe(chain.length);
    edges.forEach(([from, to], i) => {
      expect(from).toBe(chain[i]);
      expect(PEERS[from]).toContain(to);
    });
    expect(p.thermos.some(path => chain.every((c, i) => path.includes(c) && (!i || path.indexOf(chain[i - 1]) < path.indexOf(c))))).toBe(true);
    expect(step.eliminations.every(e => chain.includes(e.cell))).toBe(true);
    const previous = a.frames[index - 1];
    expect(step.values).toEqual(previous.values);
    for (let c = 0; c < 81; c++) {
      const removed = step.eliminations.filter(e => e.cell === c).reduce((mask, e) => mask | bit(e.digit), 0);
      expect(previous.candidates[c] & ~step.candidates[c]).toBe(removed);
    }
  }
  expect(a.techniques['Slow Thermometer bounds']).toBe(a.frames.filter(f => f.title === 'Slow Thermometer bounds').length);
  const fast = fastSolve(p, 30000);
  expect(fast.exhausted).toBe(true); expect(fast.solutions).toHaveLength(1);
  expect(a.frames.at(-1)!.values).toEqual(fast.solutions[0]);
  expect(validCompletion(fast.solutions[0], p.thermos, 'slow')).toBe(true);
  if (!a.guesses) expect(checkLogical(p)).toEqual(fast.solutions[0]);
}, 40000);
it('works for row and column peers, upper bounds, and keeps legal equality', () => {
  for (const path of [[0, 10, 2], [0, 10, 18]]) {
    const g = emptyGrid(); expect(applySlowThermometerBounds(g, [path])).toBe(true);
    expect(g.cands[path[2]] & bit(1)).toBe(0); expect(g.cands[path[0]] & bit(9)).toBe(0);
  }
  const g = emptyGrid(); setValue(g, 20, 5); setValue(g, 30, 5);
  expect(PEERS[20]).not.toContain(30);
  expect(applySlowThermometerBounds(g, [[20, 30]])).toBe(true);
  const impossible = emptyGrid(); setValue(impossible, 0, 5); setValue(impossible, 2, 5);
  expect(applySlowThermometerBounds(impossible, [[0, 10, 2]])).toBe(false);
});
it('retains exactly the supported digits for a small path by exhaustive enumeration', () => {
  const path = [18, 28, 20, 11, 12], g = emptyGrid();
  for (const c of path) g.cands[c] = bit(1) | bit(2) | bit(3) | bit(4) | bit(5);
  const supported = path.map(() => 0), chosen: number[] = [];
  function visit(i: number) {
    if (i === path.length) { chosen.forEach((d, j) => supported[j] |= bit(d)); return; }
    for (let d = 1; d <= 5; d++) {
      if (i && d < chosen[i - 1]) continue;
      if (chosen.some((v, j) => v === d && PEERS[path[i]].includes(path[j]))) continue;
      chosen.push(d); visit(i + 1); chosen.pop();
    }
  }
  visit(0); expect(applySlowThermometerBounds(g, [path])).toBe(true);
  path.forEach((c, i) => expect(g.cands[c]).toBe(supported[i]));
});
