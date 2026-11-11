import { adjacent, blank, DEFAULT_GENERATION, hasRepeatedStep, generationError, MIN_THERMO_LENGTH, type GenerationOptions, type Puzzle, type Variant } from './puzzle';
import { propagate, solve } from './solver';
import { cloneGrid, digitsOf, emptyGrid, popcount, setValue, type Grid } from './vendor/sudokui/board';
import { analyze, LogicalSolveStalled, type Analysis } from './walkthrough';

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
const cells = Array.from({ length: 81 }, (_, i) => i);
const neighbors = cells.map(c => cells.filter(d => adjacent(c, d)));
export const rotatePath = (path: number[]) => path.map(c => 80 - c);
const segments = (path: number[]) => path.slice(1).map((c, i) => [path[i], c]);
// Unit grid edges can cross only at the midpoint of opposite diagonals.
const crosses = ([a, b]: number[], [c, d]: number[]) =>
  a !== c && a !== d && b !== c && b !== d &&
  a % 9 + b % 9 === c % 9 + d % 9 && Math.floor(a / 9) + Math.floor(b / 9) === Math.floor(c / 9) + Math.floor(d / 9);
export function hasOverlap(paths: number[][]): boolean {
  const flat = paths.flat();
  if (new Set(flat).size !== flat.length) return true;
  const edges = paths.flatMap(segments);
  return edges.some((a, i) => edges.slice(i + 1).some(b => crosses(a, b)));
}

export interface GenerationStats { givens: number; thermometers: number; thermoCells: number; elapsedMs: number; attempts: number; pairsTested: number; pairsRemoved: number }
export interface GenerationProgress { stage: number; attempt: number; text: string }
export interface GeneratedPuzzle { puzzle: Puzzle; solution: number[]; stats: GenerationStats; analysis: Analysis }
type Progress = (progress: GenerationProgress) => void;
const budgetError = () => new Error('Generation budget reached before completing all uniqueness checks and digging. No unfinished puzzle was returned; please try again.');

/** Step 1: geometry only. There are no digits or completed grids at this point. */
export function drawLayout(symmetric: boolean, random = Math.random, count = 6, minLength = MIN_THERMO_LENGTH, maxLength = 11): number[][] | null {
  const paths: number[][] = [];
  for (let trial = 0; trial < 300 && paths.length < count; trial++) {
    const path = [Math.floor(random() * 81)];
    const spare = 81 - count * minLength;
    const length = minLength + (minLength < maxLength && spare > count && random() < .35 ? 1 : 0);
    while (path.length < length) {
      const next = shuffle(neighbors[path.at(-1)!], random).find(c => !path.includes(c) && !hasOverlap([...paths, [...path, c]]));
      if (next === undefined) break;
      path.push(next);
    }
    if (path.length < minLength) continue;
    const addition = symmetric ? [path, rotatePath(path)] : [path];
    if (!hasOverlap([...paths, ...addition])) paths.push(...addition);
  }
  return paths.length === count ? paths : null;
}

/** Randomized MRV backtracking restricted to the requested phase's cells.
 * Phase 2 never places a digit in an outside cell. Phase 3 keeps its thermo
 * assignment fixed; failure returns to a fresh layout instead of changing it. */
export function fillCells(start: Grid, p: Puzzle, targets: number[], random: () => number, deadline: number, requireRepeat: boolean): Grid | null {
  function visit(g: Grid): Grid | null {
    if (performance.now() >= deadline || !propagate(g, p.thermos, p.variant)) return null;
    const empty = targets.filter(c => !g.values[c]);
    if (!empty.length) return requireRepeat && p.variant === 'slow' && !hasRepeatedStep(g.values, p.thermos) ? null : g;
    const min = Math.min(...empty.map(c => popcount(g.cands[c])));
    const c = shuffle(empty.filter(c => popcount(g.cands[c]) === min), random)[0];
    for (const d of shuffle(digitsOf(g.cands[c]), random)) {
      const next = cloneGrid(g); setValue(next, c, d); const found = visit(next); if (found) return found;
    }
    return null;
  }
  return visit(cloneGrid(start));
}

/** Steps 1–5. One failed removal need not be retested: deleting further givens
 * can only increase the solution set. A timeout aborts, never counts as proof.
 * The rotationally fixed center is tested as a singleton orbit. */
function pipeline(variant: Variant, random: () => number, budgetMs: number, options: GenerationOptions, progress: Progress) {
  const invalid = generationError(variant, options); if (invalid) throw new Error(invalid);
  const logicalOnly = options.logicalOnly ?? true;
  const count = options.thermometerCount ?? 6, minLength = options.minThermoLength ?? 3;
  const started = performance.now(), deadline = started + budgetMs;
  let attempts = 0;
  while (performance.now() < deadline) {
    attempts++;
    progress({ stage: 1, attempt: attempts, text: `Drawing ${count} non-overlapping thermometers of ${minLength}+ cells.` });
    const paths = drawLayout(options.symmetricThermos, random, count, minLength, variant === 'thermo' ? 9 : 11); if (!paths) continue;
    const p = blank(variant, true); p.symmetricThermos = options.symmetricThermos; p.thermos = paths; p.thermometerCount = count; p.minThermoLength = minLength; p.logicalOnly = logicalOnly;
    const thermoCells = [...new Set(paths.flat())];
    progress({ stage: 2, attempt: attempts, text: 'Filling thermometer cells while obeying Sudoku and thermometer rules.' });
    const filledThermos = fillCells(emptyGrid(), p, thermoCells, random, Math.min(deadline, performance.now() + 600), true);
    if (!filledThermos) continue;
    progress({ stage: 3, attempt: attempts, text: 'Randomly completing the cells outside the thermometers.' });
    const complete = fillCells(filledThermos, p, cells.filter(c => !thermoCells.includes(c)), random, Math.min(deadline, performance.now() + 1200), true);
    if (!complete) continue;
    const solution = [...complete.values];
    progress({ stage: 4, attempt: attempts, text: 'Removing all thermometer digits and proving uniqueness.' });
    // Mirrored exclusions keep clue positions symmetric even if paths are not.
    const excluded = new Set(thermoCells.flatMap(c => [c, 80 - c]));
    p.givens = solution.map((d, c) => excluded.has(c) ? 0 : d); p.values = [...p.givens];
    const initial = solve(p, Math.max(0, deadline - performance.now()));
    if (!initial.exhausted) throw budgetError();
    if (initial.solutions.length !== 1) continue;
    let pairsTested = 0, pairsRemoved = 0;
    progress({ stage: 5, attempt: attempts, text: 'Digging rotational pairs until no remaining pair can be removed.' });
    for (const c of shuffle(Array.from({ length: 41 }, (_, i) => i), random)) {
      if (!p.givens[c]) continue;
      if (performance.now() >= deadline) throw budgetError();
      const orbit = [...new Set([c, 80 - c])], old = orbit.map(i => p.givens[i]);
      orbit.forEach(i => { p.givens[i] = p.values[i] = 0; }); pairsTested++;
      const result = solve(p, Math.max(0, deadline - performance.now()));
      if (!result.exhausted) throw budgetError();
      if (result.solutions.length === 1) pairsRemoved++;
      else orbit.forEach((i, j) => { p.givens[i] = p.values[i] = old[j]; });
    }
    let analysis: Analysis | undefined;
    if (logicalOnly) {
      progress({ stage: 6, attempt: attempts, text: 'Checking that logical techniques complete the puzzle without Brute force.' });
      try { analysis = analyze(p, Math.max(0, deadline - performance.now()), false); }
      catch (error) { if (error instanceof LogicalSolveStalled) continue; throw error; }
    }
    return { puzzle: p, solution, started, deadline, analysis, stats: { givens: p.givens.filter(Boolean).length, thermometers: paths.length, thermoCells: thermoCells.length, elapsedMs: performance.now() - started, attempts, pairsTested, pairsRemoved } };
  }
  throw logicalOnly
    ? new Error('Generation time limit reached before finding a unique puzzle solvable entirely with the supported logical techniques. Try again or disable Logical techniques only. Your current puzzle is unchanged.')
    : budgetError();
}

// Legacy call signature retained; the prescribed workflow now mandates thermo
// exclusion, disjoint paths and paired clue digging regardless of old flags.
export function generate(variant: Variant, _noThermoGivens = true, random = Math.random, budgetMs = Infinity, options: GenerationOptions = DEFAULT_GENERATION): Puzzle {
  return pipeline(variant, random, budgetMs, options, () => {}).puzzle;
}
export function generateDetailed(variant: Variant, options = DEFAULT_GENERATION, progress: Progress = () => {}, random = Math.random, budgetMs = Infinity): GeneratedPuzzle {
  const result = pipeline(variant, random, budgetMs, options, progress);
  if (!result.analysis) progress({ stage: 6, attempt: result.stats.attempts, text: 'Calculating difficulty and recording the complete solution walkthrough.' });
  const analysis = result.analysis ?? analyze(result.puzzle, Math.max(0, result.deadline - performance.now()));
  if (analysis.frames.at(-1)!.values.some((d, c) => d !== result.solution[c])) throw new Error('Walkthrough did not match the verified solution.');
  result.stats.elapsedMs = performance.now() - result.started;
  return { puzzle: result.puzzle, solution: result.solution, stats: result.stats, analysis };
}
