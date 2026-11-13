import { expect, it } from 'vitest';
import { findPhistomefelRing, PHISTOMEFEL_CORNERS as corners, PHISTOMEFEL_RING as ring } from './phistomefel-ring';
import { bit, emptyGrid } from './vendor/sudokui/board';
import { applyLogicalStep, nextLogicalStep } from './solver';
import { TECHS } from './techniques';
import { techniqueScore } from './technique-tallies';
import { repertoire } from './techniques-page';

it('uses the specified two disjoint sets of sixteen cells', () => {
  const coordinates = (cells: number[]) => cells.map(c => `${Math.floor(c / 9) + 1}${c % 9 + 1}`);
  expect(coordinates(ring)).toEqual(['33','34','35','36','37','43','47','53','57','63','67','73','74','75','76','77']);
  expect(coordinates(corners)).toEqual(['11','12','18','19','21','22','28','29','81','82','88','89','91','92','98','99']);
  expect(new Set([...ring, ...corners]).size).toBe(32);
});

it('transfers a zero tally in either direction through the shared solver', () => {
  for (const [source, target] of [[ring, corners], [corners, ring]]) {
    const g = emptyGrid();
    for (const c of source) g.cands[c] &= ~bit(9);
    const step = nextLogicalStep(g)!;
    expect(step.tech).toBe('PHISTOMEFEL_RING');
    expect(step.eliminations).toEqual(target.map(cell => ({ cell, digit: 9 })));
    expect(step.placements).toEqual([]);
    expect(step.description).toContain('exactly 0');
    applyLogicalStep(g, step);
    expect(findPhistomefelRing(g)).toBeNull();
  }
});

it('matches repeated-digit multiplicities, forcing all required places and removing surplus candidates', () => {
  const g = emptyGrid();
  for (const c of [...ring, ...corners]) g.cands[c] &= ~bit(2);
  for (const c of [20, 33, 58]) { g.values[c] = 2; g.cands[c] = 0; }
  g.cands[21] |= bit(2);
  for (const c of [0, 17, 64]) g.cands[c] |= bit(2);
  const step = findPhistomefelRing(g)!;
  expect(step.placements).toEqual([0, 17, 64].map(cell => ({ cell, digit: 2 })));
  expect(step.eliminations).toEqual([{ cell: 21, digit: 2 }]);
  expect(step.description).toContain('exactly 3');
});

it('counts singleton candidates as forced and does not claim a deduction from overlapping uncertain counts', () => {
  expect(findPhistomefelRing(emptyGrid())).toBeNull();
  const g = emptyGrid();
  for (const c of corners) g.cands[c] &= ~bit(2);
  g.cands[0] = bit(2);
  g.cands[20] = bit(2);
  const step = findPhistomefelRing(g)!;
  expect(step.eliminations).toEqual(ring.filter(c => c !== 20).map(cell => ({ cell, digit: 2 })));
  expect(step.placements).toEqual([]);
});

it('never removes the known solution from randomized candidate supersets', () => {
  const solved = [...'534678912672195348198342567859761423426853791713924856961537284287419635345286179'].map(Number);
  let seed = 42, deductions = 0;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let trial = 0; trial < 250; trial++) {
    const g = emptyGrid();
    for (let c = 0; c < 81; c++) {
      if (random() < 0.5) { g.values[c] = solved[c]; g.cands[c] = 0; }
      else {
        g.cands[c] = bit(solved[c]);
        for (let digit = 1; digit <= 9; digit++) if (random() < 0.25) g.cands[c] |= bit(digit);
      }
    }
    const step = findPhistomefelRing(g);
    if (!step) continue;
    deductions++;
    for (const e of step.eliminations) expect(e.digit).not.toBe(solved[e.cell]);
    for (const p of step.placements) expect(p.digit).toBe(solved[p.cell]);
  }
  expect(deductions).toBeGreaterThan(0);
});

it('registers the same 200-point rating for walkthroughs, tallies, and the repertoire', () => {
  expect(TECHS.PHISTOMEFEL_RING.score).toBe(200);
  expect(techniqueScore('Phistomefel Ring')).toBe(200);
  expect(repertoire.find(t => t.name === 'Phistomefel Ring')?.score).toBe(200);
});
