import { describe, expect, it } from 'vitest';
import { drawLayout, fillCells, generateDetailed, hasOverlap, rotatePath } from './generator';
import { blank, DEFAULT_GENERATION, hasRepeatedStep } from './puzzle';
import { conflicts, solve } from './solver';
import { emptyGrid } from './vendor/sudokui/board';

function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
describe('six-stage generation', () => {
  it('draws geometry before values and fills only thermometer cells in phase two', () => {
    const random = seeded(11), p = blank(); p.thermos = drawLayout(true, random)!;
    expect(p.thermos.length).toBeGreaterThanOrEqual(6);
    expect(p.values.every(d => d === 0)).toBe(true);
    expect(hasOverlap(p.thermos)).toBe(false);
    const cells = [...new Set(p.thermos.flat())];
    const g = fillCells(emptyGrid(), p, cells, random, performance.now() + 2000, true);
    expect(g).not.toBeNull();
    for (let c = 0; c < 81; c++) expect(g!.values[c] !== 0).toBe(cells.includes(c));
  });
  for (const variant of ['thermo', 'slow'] as const) it(`finishes exhaustive digging and records a complete ${variant} walkthrough`, () => {
    const stages: number[] = [];
    const result = generateDetailed(variant, DEFAULT_GENERATION, p => stages.push(p.stage), seeded(7), 30000);
    const { puzzle: p, solution, analysis, stats } = result;
    // Digging/logical checks can repeat for different orders on one filled grid.
    expect(stages.at(-1)).toBe(6);
    for (const stage of [1, 2, 3, 4, 5]) expect(stages.lastIndexOf(stage)).toBeLessThan(stages.lastIndexOf(stage + 1));
    expect(p.thermos.length).toBeGreaterThanOrEqual(6); expect(hasOverlap(p.thermos)).toBe(false);
    for (const t of p.thermos) { expect(t.length).toBeGreaterThanOrEqual(3); expect(p.thermos).toContainEqual(rotatePath(t)); for (const c of t) expect(p.givens[c]).toBe(0); }
    expect(conflicts({ ...p, values: solution }).size).toBe(0);
    if (variant === 'slow') expect(hasRepeatedStep(solution, p.thermos)).toBe(true);
    expect(solve(p).solutions).toEqual([solution]);
    for (let c = 0; c <= 40; c++) {
      expect(!!p.givens[c]).toBe(!!p.givens[80 - c]);
      if (!p.givens[c]) continue;
      const next = structuredClone(p); next.values[c] = next.givens[c] = next.values[80 - c] = next.givens[80 - c] = 0;
      const r = solve(next, 10000); expect(r.exhausted).toBe(true); expect(r.solutions.length).toBe(2);
    }
    expect(stats.givens).toBe(p.givens.filter(Boolean).length);
    expect(stats.thermoCells).toBe(new Set(p.thermos.flat()).size); expect(stats.elapsedMs).toBeGreaterThan(0);
    expect(analysis.frames[0].values).toEqual(p.givens); expect(analysis.frames.at(-1)!.values).toEqual(solution);
    expect(analysis.score).toBeGreaterThan(0);
    for (const f of analysis.frames) for (const { cell, digit } of f.placements) expect(f.values[cell]).toBe(digit);
    console.log(variant, { ms: Math.round(stats.elapsedMs), givens: stats.givens, attempts: stats.attempts, slides: analysis.frames.length, level: analysis.level });
  }, 40000);
});
