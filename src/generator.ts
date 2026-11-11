import { adjacent, blank, hasRepeatedStep, type Puzzle, type Variant } from './puzzle';
import { solve } from './solver';

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
const cells = Array.from({ length: 81 }, (_, i) => i);
const neighbors = cells.map(c => cells.filter(d => adjacent(c, d)));
function fullGrid(random: () => number): number[] {
  const order = () => shuffle([0, 1, 2], random).flatMap(b => shuffle([0, 1, 2], random).map(n => 3 * b + n));
  const rows = order(), cols = order(), digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  return rows.flatMap(r => cols.map(c => digits[(r * 3 + Math.floor(r / 3) + c) % 9]));
}
/** Builds from a known valid solution, then removes clues only after proving uniqueness.
 * Failed/time-limited attempts are discarded; they never reach the UI. */
export function generate(variant: Variant, noThermoGivens = true, random = Math.random, budgetMs = 10000): Puzzle {
  const deadline = performance.now() + budgetMs;
  while (performance.now() < deadline) {
    const solution = fullGrid(random), p = blank(variant, noThermoGivens);
    const edges = cells.flatMap(a => neighbors[a].filter(b => solution[a] === solution[b]).map(b => [a, b]));
    if (variant === 'slow' && !edges.length) continue;
    const paths: number[][] = variant === 'slow' ? [shuffle(edges, random)[0]] : [];
    for (const start of shuffle(cells, random)) {
      if (paths.length >= 6) break;
      const t = [start];
      while (t.length < 4) {
        const last = t.at(-1)!;
        const next = shuffle(neighbors[last], random).find(c => !t.includes(c) && (variant === 'slow' ? solution[c] >= solution[last] : solution[c] > solution[last]));
        if (next === undefined) break;
        t.push(next);
      }
      if (t.length >= 3 && !paths.some(path => path.join() === t.join())) paths.push(t);
    }
    p.thermos = paths;
    if (paths.length < 4 || (variant === 'slow' && !hasRepeatedStep(solution, paths))) continue;
    const onThermo = new Set(paths.flat());
    p.givens = solution.map((d, c) => noThermoGivens && onThermo.has(c) ? 0 : d);
    p.values = [...p.givens];
    const remaining = () => Math.max(0, Math.min(250, deadline - performance.now()));
    const initial = solve(p, remaining());
    if (!initial.exhausted || initial.solutions.length !== 1) continue;
    for (const c of shuffle(cells.filter(c => p.givens[c] !== 0), random)) {
      if (performance.now() >= deadline || p.givens.filter(Boolean).length <= 28) break;
      const old = p.givens[c]; p.givens[c] = p.values[c] = 0;
      const result = solve(p, remaining());
      if (!result.exhausted || result.solutions.length !== 1) p.givens[c] = p.values[c] = old;
    }
    return p;
  }
  throw new Error('Could not finish a unique puzzle within the generation budget. Please generate again.');
}
