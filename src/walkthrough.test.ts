import { expect, it } from 'vitest';
import { analyze } from './walkthrough';
import { blank } from './puzzle';
import { solve } from './solver';
import { TECHS } from './vendor/sudokui/ratings';

it('records actual backtracking trials and restored states on a hard puzzle', () => {
  const p = blank();
  p.givens = [...'100007090030020008009600500005300900010080002600004000300000010040000007007000300'].map(Number);
  p.values = [...p.givens];
  const a = analyze(p, 20000);
  expect(a.guesses).toBeGreaterThan(0); expect(a.backtracks).toBeGreaterThan(0); expect(a.level).toBe('Extreme');
  expect(a.techniques['Brute force']).toBe(a.guesses);
  expect(a.techniques['Backtracking trial']).toBeUndefined();
  expect(a.hardest).toBe('Brute force');
  expect(a.frames.filter(f => f.kind === 'guess').every(f => f.title === 'Brute force')).toBe(true);
  const logicalScore = Object.entries(a.techniques).reduce((sum, [name, count]) => {
    if (name === 'Brute force') return sum;
    const weight = name === 'Thermometer bounds' ? 5 : Object.values(TECHS).find(t => t.name === name)!.score;
    return sum + count * weight;
  }, 0);
  expect(a.score).toBe(logicalScore + a.guesses * 10000);
  expect(a.frames.some(f => f.kind === 'guess' && f.description.includes('assumption'))).toBe(true);
  expect(a.frames.filter(f => f.kind === 'backtrack')).toHaveLength(a.backtracks);
  expect(a.frames.at(-1)!.values).toEqual(solve(p, 20000).solutions[0]);
  for (const f of a.frames) p.givens.forEach((d, c) => { if (d) expect(f.values[c]).toBe(d); });
}, 30000);
it('does not report an unfinished walkthrough when the analysis budget expires', () => {
  expect(() => analyze(blank(), 0)).toThrow(/budget/);
});
