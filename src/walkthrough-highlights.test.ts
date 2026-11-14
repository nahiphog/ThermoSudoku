import { expect, it } from 'vitest';
import { techniqueCells } from './walkthrough-highlights';
import { analyze } from './walkthrough';
import { blank } from './puzzle';
import { PHISTOMEFEL_RING, PHISTOMEFEL_CORNERS, findPhistomefelRing } from './phistomefel-ring';
import { bit, emptyGrid } from './vendor/sudokui/board';
import { fullHouseStep } from './vendor/sudokui/techniques/singles';
import { board } from './grid-markup';

it('preserves all house and pattern evidence, not just the cells being changed', () => {
  expect(techniqueCells(fullHouseStep(0, 0, 1))).toEqual([0]);
  expect(techniqueCells(fullHouseStep(18, 0, 1))).toEqual([0]);
  const g = emptyGrid();
  for (const c of PHISTOMEFEL_RING) g.cands[c] &= ~bit(9);
  expect(techniqueCells(findPhistomefelRing(g)!)).toEqual([...PHISTOMEFEL_RING, ...PHISTOMEFEL_CORNERS].sort((a,b) => a-b));
});

it('every recorded deduction, trial, contradiction, and rollback has relevant cells and renders them', () => {
  const p = blank();
  p.givens = [...'100007090030020008009600500005300900010080002600004000300000010040000007007000300'].map(Number);
  p.values = [...p.givens];
  const analysis = analyze(p, 20000);
  expect(analysis.frames.some(f => f.kind === 'backtrack')).toBe(true);
  expect(analysis.frames.some(f => f.kind === 'contradiction')).toBe(true);
  for (const f of analysis.frames) {
    if (!['start', 'finish'].includes(f.kind)) expect(f.relatedCells!.length, f.title).toBeGreaterThan(0);
    expect(f.relatedCells!.every(c => Number.isInteger(c) && c >= 0 && c < 81)).toBe(true);
    for (const { cell } of [...f.placements, ...f.eliminations]) expect(f.relatedCells).toContain(cell);
    expect((board(p, f.values, [], f).match(/step-reason/g) ?? []).length).toBe(f.relatedCells!.length);
  }
  expect(analysis.frames[0].relatedCells).toEqual([]);
  expect(analysis.frames.at(-1)!.relatedCells).toHaveLength(0);
}, 30000);
