import { adjacent, blank, DEFAULT_GENERATION, hasRepeatedStep, generationError, MIN_THERMO_LENGTH, type GenerationOptions, type Puzzle, type Variant } from './puzzle';
import { checkLogical } from './logical-runner';
import { compileConstraints, createUniquenessChecker, propagateDomains, validCompletion } from './fast-solver';
import { bit, cloneGrid, digitsOf, emptyGrid, popcount, setValue, type Grid } from './vendor/sudokui/board';
import { analyze, type Analysis } from './walkthrough';

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

export interface GenerationProfile {
  stageMs: Record<'layout' | 'fillThermos' | 'fillGrid' | 'uniqueness' | 'logical' | 'walkthrough', number>;
  layoutFailures: number; fillFailures: number; nonUniqueLayouts: number; logicalRejected: number;
  diggingPasses: number; uniquenessCalls: number; cacheHits: number; searchNodes: number; fillNodes: number;
}
export interface GenerationTuning { diggingOrders?: number }
export interface GenerationStats { profile?: GenerationProfile; givens: number; thermometers: number; thermoCells: number; elapsedMs: number; attempts: number; pairsTested: number; pairsRemoved: number }
export interface GenerationProgress { stage: number; attempt: number; text: string }
export interface GeneratedPuzzle { puzzle: Puzzle; solution: number[]; stats: GenerationStats; analysis: Analysis }
type Progress = (progress: GenerationProgress) => void;
const budgetError = () => new Error('Generation budget reached before completing all uniqueness checks and digging. No unfinished puzzle was returned; please try again.');

/** Step 1: geometry only. There are no digits or completed grids at this point. */
export function drawLayout(symmetric: boolean, random = Math.random, count = 6, minLength = MIN_THERMO_LENGTH, maxLength = 11): number[][] | null {
  if (count * minLength > 81 || (symmetric && count % 2)) return null;
  const paths: number[][] = [], occupied = new Uint8Array(81), diagonals = new Int8Array(64);
  let used = 0;
  const diagonal = (a: number, b: number) => {
    const dr = Math.floor(b / 9) - Math.floor(a / 9), dc = b % 9 - a % 9;
    return dr && dc ? [Math.min(Math.floor(a / 9), Math.floor(b / 9)) * 8 + Math.min(a % 9, b % 9), dr * dc > 0 ? 1 : 2] : null;
  };
  const fits = (addition: number[][]) => {
    const seen = new Set<number>(), local = new Map<number, number>();
    for (const path of addition) for (let i = 0; i < path.length; i++) {
      const c = path[i]; if (occupied[c] || seen.has(c)) return false; seen.add(c);
      const d = i ? diagonal(path[i - 1], c) : null;
      if (d) { const previous = diagonals[d[0]] || local.get(d[0]); if (previous && previous !== d[1]) return false; local.set(d[0], d[1]); }
    }
    return true;
  };
  for (let trial = 0; trial < 300 && paths.length < count; trial++) {
    const path = [Math.floor(random() * 81)];
    const spare = 81 - count * minLength;
    const length = minLength + (minLength < maxLength && spare > count && random() < .35 ? 1 : 0);
    while (path.length < length) {
      const next = shuffle(neighbors[path.at(-1)!], random).find(c => fits([[...path, c]]));
      if (next === undefined) break;
      path.push(next);
    }
    if (path.length < minLength) continue;
    const addition = symmetric ? [path, rotatePath(path)] : [path];
    const extra = addition.reduce((n, t) => n + t.length, 0);
    if (used + extra + (count - paths.length - addition.length) * minLength > 81 || !fits(addition)) continue;
    for (const t of addition) for (let i = 0; i < t.length; i++) {
      occupied[t[i]] = 1; const d = i ? diagonal(t[i - 1], t[i]) : null; if (d) diagonals[d[0]] = d[1];
    }
    used += extra; paths.push(...addition);
  }
  return paths.length === count ? paths : null;
}

/** Randomized MRV backtracking restricted to the requested phase's cells.
 * Phase 2 never places a digit in an outside cell. Phase 3 keeps its thermo
 * assignment fixed; failure returns to a fresh layout instead of changing it. */
export function fillCells(start: Grid, p: Puzzle, targets: number[], random: () => number, deadline: number, requireRepeat: boolean, compiled = compileConstraints(p.thermos, p.variant), onNode?: () => void): Grid | null {
  const initial = new Uint16Array(81);
  for (let c = 0; c < 81; c++) initial[c] = start.values[c] ? bit(start.values[c]) : start.cands[c];
  function visit(domains: Uint16Array): Grid | null {
    onNode?.();
    if (performance.now() >= deadline || !propagateDomains(domains, compiled)) return null;
    let min = 10; const ties: number[] = [];
    for (const c of targets) {
      const n = popcount(domains[c]); if (n <= 1) continue;
      if (n < min) { min = n; ties.length = 0; } if (n === min) ties.push(c);
    }
    if (!ties.length) {
      const result = cloneGrid(start);
      // Only this phase's target cells become placed digits.
      for (const c of targets) if (!result.values[c]) setValue(result, c, 32 - Math.clz32(domains[c]));
      return requireRepeat && p.variant === 'slow' && !hasRepeatedStep(result.values, p.thermos) ? null : result;
    }
    const c = shuffle(ties, random)[0];
    for (const digit of shuffle(digitsOf(domains[c]), random)) {
      const next = domains.slice(); next[c] = bit(digit); const found = visit(next); if (found) return found;
    }
    return null;
  }
  return visit(initial);
}

/** Steps 1–5. One failed removal need not be retested: deleting further givens
 * can only increase the solution set. A timeout aborts, never counts as proof.
 * The rotationally fixed center is tested as a singleton orbit. */
function pipeline(variant: Variant, random: () => number, budgetMs: number, options: GenerationOptions, progress: Progress, tuning: GenerationTuning = {}) {
  const invalid = generationError(variant, options); if (invalid) throw new Error(invalid);
  const logicalOnly = options.logicalOnly ?? true;
  const count = options.thermometerCount ?? 6, minLength = options.minThermoLength ?? 3;
  const started = performance.now(), deadline = started + budgetMs;
  const profile: GenerationProfile = {
    stageMs: { layout: 0, fillThermos: 0, fillGrid: 0, uniqueness: 0, logical: 0, walkthrough: 0 },
    layoutFailures: 0, fillFailures: 0, nonUniqueLayouts: 0, logicalRejected: 0, diggingPasses: 0,
    uniquenessCalls: 0, cacheHits: 0, searchNodes: 0, fillNodes: 0,
  };
  const timed = <T>(stage: keyof GenerationProfile['stageMs'], action: () => T): T => {
    const before = performance.now(); try { return action(); } finally { profile.stageMs[stage] += performance.now() - before; }
  };
  const requestedOrders = tuning.diggingOrders ?? 2;
  if (!Number.isInteger(requestedOrders) || requestedOrders < 1 || requestedOrders > 16) throw new Error('Digging orders must be an integer from 1 to 16.');
  const orders = logicalOnly ? requestedOrders : 1;
  let attempts = 0;
  while (performance.now() < deadline) {
    attempts++;
    progress({ stage: 1, attempt: attempts, text: `Drawing ${count} non-overlapping thermometers of ${minLength}+ cells.` });
    const paths = timed('layout', () => drawLayout(options.symmetricThermos, random, count, minLength, variant === 'thermo' ? 9 : 11));
    if (!paths) { profile.layoutFailures++; continue; }
    const p = blank(variant, true); p.symmetricThermos = options.symmetricThermos; p.thermos = paths;
    p.thermometerCount = count; p.minThermoLength = minLength; p.logicalOnly = logicalOnly;
    const compiled = compileConstraints(paths, variant);
    if (variant === 'slow' && !compiled.repeats.length) { profile.layoutFailures++; continue; }
    const thermoCells = [...new Set(paths.flat())], thermoSet = new Set(thermoCells);
    progress({ stage: 2, attempt: attempts, text: 'Filling thermometer cells while obeying Sudoku and thermometer rules.' });
    const filledThermos = timed('fillThermos', () => fillCells(emptyGrid(), p, thermoCells, random, Math.min(deadline, performance.now() + 600), true, compiled, () => profile.fillNodes++));
    if (!filledThermos) { profile.fillFailures++; continue; }
    progress({ stage: 3, attempt: attempts, text: 'Randomly completing the cells outside the thermometers.' });
    const complete = timed('fillGrid', () => fillCells(filledThermos, p, cells.filter(c => !thermoSet.has(c)), random, Math.min(deadline, performance.now() + 1200), true, compiled, () => profile.fillNodes++));
    if (!complete) { profile.fillFailures++; continue; }
    const solution = [...complete.values];
    const checker = createUniquenessChecker(p, solution);
    const unique = (givens: number[], cached = true) => timed('uniqueness', () => {
      const before = checker.metrics(), r = checker.check(givens, deadline, cached), after = checker.metrics();
      profile.uniquenessCalls++; profile.cacheHits += after.hits - before.hits; profile.searchNodes += after.nodes - before.nodes;
      if (!r.exhausted) throw budgetError(); return r.unique;
    });
    progress({ stage: 4, attempt: attempts, text: 'Removing all thermometer digits and proving uniqueness.' });
    const excluded = new Set(thermoCells.flatMap(c => [c, 80 - c]));
    const startingGivens = solution.map((d, c) => excluded.has(c) ? 0 : d);
    if (!unique(startingGivens)) { profile.nonUniqueLayouts++; continue; }
    // Try different minimal clue sets before throwing away a valid construction.
    for (let order = 0; order < orders; order++) {
      if (performance.now() >= deadline) throw budgetError();
      p.givens = [...startingGivens]; p.values = [...startingGivens];
      let pairsTested = 0, pairsRemoved = 0; profile.diggingPasses++;
      progress({ stage: 5, attempt: attempts, text: `Digging rotational pairs until none can be removed (order ${order + 1}).` });
      for (const c of shuffle(Array.from({ length: 41 }, (_, i) => i), random)) {
        if (!p.givens[c]) continue;
        if (performance.now() >= deadline) throw budgetError();
        const orbit = c === 40 ? [c] : [c, 80 - c], old = orbit.map(i => p.givens[i]);
        orbit.forEach(i => { p.givens[i] = p.values[i] = 0; }); pairsTested++;
        if (unique(p.givens)) pairsRemoved++;
        else orbit.forEach((i, j) => { p.givens[i] = p.values[i] = old[j]; });
      }
      progress({ stage: 6, attempt: attempts, text: logicalOnly ? 'Checking a complete logical solution without Brute force.' : 'Recording the complete solution walkthrough.' });
      if (logicalOnly) {
        const logical = timed('logical', () => checkLogical(p, deadline));
        if (!logical) { profile.logicalRejected++; continue; }
        if (logical.some((d, c) => d !== solution[c])) throw new Error('Logical solution did not match the verified completion.');
      }
      // Fresh uncached verification gates publication; failures never relax options.
      if (!unique(p.givens, false) || !validCompletion(solution, paths, variant)) throw new Error('Final uniqueness verification failed.');
      if (paths.length !== count || paths.some(t => t.length < minLength) || hasOverlap(paths)
        || thermoCells.some(c => p.givens[c] !== 0)
        || p.givens.some((d, c) => !!d !== !!p.givens[80 - c] || (d !== 0 && d !== solution[c]))
        || (options.symmetricThermos && paths.some(t => !paths.some(other => other.length === t.length && other.every((c, i) => c === 80 - t[i]))))) {
        throw new Error('Final generation constraints did not match the requested options.');
      }
      const analysis = timed('walkthrough', () => analyze(p, Math.max(0, deadline - performance.now()), !logicalOnly));
      if (analysis.frames.at(-1)!.values.some((d, c) => d !== solution[c]) || (logicalOnly && analysis.guesses)) throw new Error('Walkthrough did not match the verified logical solution.');
      return { puzzle: p, solution, analysis, stats: { profile, givens: p.givens.filter(Boolean).length, thermometers: paths.length, thermoCells: thermoCells.length, elapsedMs: performance.now() - started, attempts, pairsTested, pairsRemoved } };
    }
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
export function generateDetailed(variant: Variant, options = DEFAULT_GENERATION, progress: Progress = () => {}, random = Math.random, budgetMs = Infinity, tuning: GenerationTuning = {}): GeneratedPuzzle {
  return pipeline(variant, random, budgetMs, options, progress, tuning);
}
