import { adjacent, blank, DEFAULT_GENERATION, hasRepeatedStep, MIN_THERMO_LENGTH, type GenerationOptions, type Puzzle, type Variant } from './puzzle';
import { solve } from './solver';

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
function fullGrid(random: () => number): number[] {
  const order = () => shuffle([0, 1, 2], random).flatMap(b => shuffle([0, 1, 2], random).map(n => 3 * b + n));
  const rows = order(), cols = order(), digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  return rows.flatMap(r => cols.map(c => digits[(r * 3 + Math.floor(r / 3) + c) % 9]));
}
/** Prove uniqueness after mandatory exclusions and every optional clue removal.
 * Symmetry includes bulb orientation. Symmetric clue removal uses 180° orbits. */
export function generate(variant: Variant, noThermoGivens = true, random = Math.random, budgetMs = 10000, options: GenerationOptions = DEFAULT_GENERATION): Puzzle {
  const deadline = performance.now() + budgetMs;
  while (performance.now() < deadline) {
    const solution = fullGrid(random), p = { ...blank(variant, noThermoGivens), symmetricGivens: options.symmetricGivens, symmetricThermos: options.symmetricThermos, noOverlap: options.noOverlap };
    const permits = (a: number, b: number) => variant === 'slow' ? solution[a] <= solution[b] : solution[a] < solution[b];
    const possible: number[][] = [];
    function extend(path: number[]) {
      if (path.length >= MIN_THERMO_LENGTH) { possible.push(path); return; }
      for (const c of neighbors[path.at(-1)!]) {
        if (path.includes(c) || !permits(path.at(-1)!, c)) continue;
        if (options.symmetricThermos && !permits(80 - path.at(-1)!, 80 - c)) continue;
        extend([...path, c]);
      }
    }
    for (const c of cells) extend([c]);
    const ordered = shuffle(possible, random);
    // Reserve a repeated path first so disjoint paths cannot crowd it out.
    if (variant === 'slow') ordered.sort((a, b) => Number(hasRepeatedStep(solution, [b])) - Number(hasRepeatedStep(solution, [a])));
    const paths: number[][] = [];
    for (const path of ordered) {
      const pair = options.symmetricThermos ? [path, rotatePath(path)] : [path];
      if (pair.some(t => paths.some(existing => existing.join() === t.join()))) continue;
      if (options.noOverlap && hasOverlap([...paths, ...pair])) continue;
      paths.push(...pair);
      if (paths.length >= 6) break;
    }
    if (paths.length < 4 || (variant === 'slow' && !hasRepeatedStep(solution, paths))) continue;
    p.thermos = paths;
    const excluded = new Set(noThermoGivens ? paths.flat() : []);
    if (options.symmetricGivens) for (const c of [...excluded]) excluded.add(80 - c);
    p.givens = solution.map((d, c) => excluded.has(c) ? 0 : d); p.values = [...p.givens];
    const remaining = () => Math.max(0, Math.min(250, deadline - performance.now()));
    const initial = solve(p, remaining());
    if (!initial.exhausted || initial.solutions.length !== 1) continue;
    for (const c of shuffle(cells, random)) {
      if (performance.now() >= deadline || p.givens.filter(Boolean).length <= 28) break;
      if (!p.givens[c]) continue;
      const orbit = options.symmetricGivens ? [...new Set([c, 80 - c])] : [c];
      const old = orbit.map(i => p.givens[i]);
      for (const i of orbit) p.givens[i] = p.values[i] = 0;
      const result = solve(p, remaining());
      if (!result.exhausted || result.solutions.length !== 1) orbit.forEach((i, j) => { p.givens[i] = p.values[i] = old[j]; });
    }
    return p;
  }
  throw new Error('Could not finish a unique puzzle within the generation budget. Please generate again.');
}
