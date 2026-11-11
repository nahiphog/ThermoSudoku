import { bit, cloneGrid, digitsOf, gridFromValues, isBroken, isSolved, PEERS, popcount, setValue, type Grid } from './vendor/sudokui/board';
import type { Step } from './vendor/sudokui/steps';
import { findFullHouse, findHiddenSingle, findNakedSingle } from './vendor/sudokui/techniques/singles';
import { findLockedCandidates1, findLockedCandidates2 } from './vendor/sudokui/techniques/intersections';
import { findHiddenSubset, findNakedSubset } from './vendor/sudokui/techniques/subsets';
import { findBasicFish, findFinnedFish } from './vendor/sudokui/techniques/fish';
import { findWWing, findXYWing, findXYZWing } from './vendor/sudokui/techniques/wings';
import { findEmptyRectangle, findTurbotFamily } from './vendor/sudokui/techniques/singleDigit';
import { hasRepeatedStep, validatePuzzle, type Puzzle, type Variant } from './puzzle';

// Explicitly opt in only to deductions independent of uniqueness assumptions.
const finders: ((g: Grid) => Step | null)[] = [
  findFullHouse, findNakedSingle, findHiddenSingle,
  findLockedCandidates1, findLockedCandidates2,
  ...[2, 3, 4].flatMap(n => [(g: Grid) => findNakedSubset(g, n, false), (g: Grid) => findHiddenSubset(g, n)]),
  ...[2, 3, 4].map(n => (g: Grid) => findBasicFish(g, n)),
  findXYWing, findXYZWing, findWWing,
  (g: Grid) => findTurbotFamily(g, 'SKYSCRAPER'), (g: Grid) => findTurbotFamily(g, 'TWO_STRING_KITE'), findEmptyRectangle,
  ...[2, 3, 4].flatMap(n => [(g: Grid) => findFinnedFish(g, n, false), (g: Grid) => findFinnedFish(g, n, true)])
];
const domain = (g: Grid, c: number) => g.values[c] ? bit(g.values[c]) : g.cands[c];
export function conflicts(p: Puzzle): Set<number> {
  const bad = new Set<number>();
  p.values.forEach((v, c) => { if (v) for (const other of PEERS[c]) if (p.values[other] === v) { bad.add(c); bad.add(other); } });
  for (const t of p.thermos) {
    t.forEach((c, i) => {
      const v = p.values[c];
      if (p.variant !== 'slow' && v && (v < i + 1 || v > 9 - (t.length - 1 - i))) bad.add(c);
      for (let j = i + 1; j < t.length; j++) if (v && p.values[t[j]] && p.values[t[j]] - v < (p.variant === 'slow' ? 0 : j - i)) { bad.add(c); bad.add(t[j]); }
    });
  }
  return bad;
}
/** Arc consistency for each directed edge, iterated across overlapping paths.
 * Fixed digits are singleton domains, so they constrain both directions.
 * No domain ever grows; contradictory cycles terminate with an empty domain. */
export function propagate(g: Grid, thermos: number[][], variant: Variant = 'thermo'): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of thermos) for (let i = 1; i < t.length; i++) {
      const a = t[i - 1], b = t[i];
      const da = digitsOf(domain(g, a)), db = digitsOf(domain(g, b));
      const permits = (x: number, y: number) => x < y || (variant === 'slow' && x === y && !PEERS[a].includes(b));
      const ma = da.filter(x => db.some(y => permits(x, y))).reduce((m, d) => m | bit(d), 0);
      const mb = db.filter(y => da.some(x => permits(x, y))).reduce((m, d) => m | bit(d), 0);
      if (!ma || !mb) return false;
      if (!g.values[a] && ma !== g.cands[a]) { g.cands[a] = ma; changed = true; }
      if (!g.values[b] && mb !== g.cands[b]) { g.cands[b] = mb; changed = true; }
    }
  }
  // Slow puzzles must admit at least one equal consecutive pair somewhere.
  const repeatPossible = variant !== 'slow' || thermos.some(t => t.some((c, i) => i > 0 && !PEERS[c].includes(t[i - 1]) && (domain(g, c) & domain(g, t[i - 1])) !== 0));
  return repeatPossible && !isBroken(g);
}
export function candidates(p: Puzzle): { grid: Grid; valid: boolean } {
  const grid = gridFromValues(p.values);
  return { grid, valid: conflicts(p).size === 0 && propagate(grid, p.thermos, p.variant) };
}
export interface Hint { description: string; values: number[]; candidates: number[]; technique: string }
export function hint(p: Puzzle): Hint | null {
  p = validatePuzzle(p);
  const { grid: g, valid } = candidates(p);
  if (!valid) throw new Error('This position has a contradiction. Check the highlighted digits or undo your last move.');
  const base = gridFromValues(p.values);
  const narrowed = [...g.cands].filter((mask, i) => !g.values[i] && mask !== base.cands[i]).length;
  const descriptions: string[] = narrowed ? [`Thermometer order narrows the candidates in ${narrowed} cells before applying Sudoku techniques.`] : [];
  for (let iteration = 0; iteration < 200; iteration++) {
    const step = finders.reduce<Step | null>((found, fn) => found ?? fn(g), null);
    if (!step) return descriptions.length ? { description: descriptions.join('\n'), values: [...g.values], candidates: [...g.cands], technique: 'Candidate eliminations' } : null;
    for (const { cell, digit } of step.eliminations) g.cands[cell] &= ~bit(digit);
    for (const { cell, digit } of step.placements) setValue(g, cell, digit);
    descriptions.push(step.description);
    if (!propagate(g, p.thermos, p.variant)) throw new Error('No valid continuation from this position.');
    if (step.placements.length) return { description: descriptions.join('\n'), values: [...g.values], candidates: [...g.cands], technique: step.tech.replaceAll('_', ' ') };
  }
  return null;
}
export interface SolveResult { solutions: number[][]; exhausted: boolean; nodes: number }
export function solve(p: Puzzle, budgetMs = 5000): SolveResult {
  p = validatePuzzle(p);
  const { grid, valid } = candidates(p);
  const result: SolveResult = { solutions: [], exhausted: true, nodes: 0 };
  if (!valid) return result;
  const deadline = performance.now() + budgetMs;
  function visit(g: Grid): void {
    if (result.solutions.length >= 2 || !result.exhausted) return;
    if (performance.now() >= deadline) { result.exhausted = false; return; }
    result.nodes++;
    while (true) {
      if (!propagate(g, p.thermos, p.variant)) return;
      const single = findNakedSingle(g) ?? findHiddenSingle(g);
      if (!single) break;
      for (const { cell, digit } of single.placements) setValue(g, cell, digit);
    }
    if (isSolved(g)) { if (p.variant !== 'slow' || hasRepeatedStep(g.values, p.thermos)) result.solutions.push([...g.values]); return; }
    let cell = -1, count = 10;
    for (let c = 0; c < 81; c++) if (!g.values[c] && popcount(g.cands[c]) < count) { cell = c; count = popcount(g.cands[c]); }
    for (const d of digitsOf(g.cands[cell])) { const next = cloneGrid(g); setValue(next, cell, d); visit(next); }
  }
  visit(grid);
  return result;
}
