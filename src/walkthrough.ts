import { techniqueCells, techniqueCandidates, contradictionCells, type CandidateHighlight } from './walkthrough-highlights';
import { bulbFindingDescription } from './missing-thermometer';
import { slowBoundsDescription } from './slow-thermometer';
import { TECHS } from './techniques';
import { conflicts } from './solver';
import { runLogical } from './logical-runner';
import { hasRepeatedStep, type Puzzle } from './puzzle';
import { bit, cellName, cloneGrid, digitsOf, gridFromValues, isSolved, popcount, setValue, type Grid } from './vendor/sudokui/board';
import { LEVELS, LEVEL_MAX_SCORE, type Level } from './vendor/sudokui/ratings';
import type { CellDigit } from './vendor/sudokui/steps';

export interface Frame { relatedUnits?: number[]; candidateHighlights?: CandidateHighlight[]; relatedCells?: number[]; title: string; description: string; values: number[]; candidates: number[]; placements: CellDigit[]; eliminations: CellDigit[]; bulbFinding?: { path: number[]; bulb: number; rejected: number }; bulbEnds?: (number | null)[]; strictInequalities?: [number, number][]; kind: 'bulb' | 'start' | 'logic' | 'thermo' | 'guess' | 'contradiction' | 'backtrack' | 'finish' }
export interface Analysis { frames: Frame[]; score: number; level: Level; hardest: string; guesses: number; backtracks: number; techniques: Record<string, number> }
/** A replay of the actual solving process, including failed trials and rollback.
 * This is an estimate: upstream technique weights + 5 per thermo reduction +
 * 10000 per Brute force use. Trials always force Extreme, never masquerade as deductions. */
export class LogicalSolveStalled extends Error { constructor() { super('The supported logical techniques cannot complete this puzzle without Brute force.'); } }
export function analyze(p: Puzzle, budgetMs = 10000, allowBruteForce = true): Analysis {
  const result: Analysis = { frames: [], score: 0, level: 'Easy', hardest: 'None', guesses: 0, backtracks: 0, techniques: {} };
  const deadline = performance.now() + budgetMs;
  let hardestWeight = -1;
  const bulbs = new WeakMap<Grid, (number | null)[]>();
  if (conflicts(p).size) throw new Error('Cannot analyze a contradictory puzzle.');
  const add = (g: Grid, kind: Frame['kind'], title: string, description: string, placements: CellDigit[] = [], eliminations: CellDigit[] = [], strictInequalities?: [number, number][], relatedCells?: number[], candidateHighlights?: CandidateHighlight[]) => {
    if (result.frames.length >= 20000 || performance.now() >= deadline) throw new Error('Analysis budget reached before a complete walkthrough was recorded. Try generating again.');
    const previous = result.frames.at(-1);
    const affected = relatedCells ?? (kind === 'start' ? []
      : kind === 'finish' ? []
      : kind === 'contradiction' ? contradictionCells(g, p)
      : kind === 'backtrack' ? Array.from({ length: 81 }, (_, c) => c).filter(c => previous && (previous.values[c] !== g.values[c] || previous.candidates[c] !== g.cands[c]))
      : [...placements, ...eliminations].map(p => p.cell));
    if (kind === 'backtrack') p.thermos.forEach((path, i) => {
      if (previous?.bulbEnds?.[i] !== bulbs.get(g)?.[i]) affected.push(...path);
    });
    const marks: CandidateHighlight[] = candidateHighlights ?? (kind === 'thermo' || kind === 'bulb' || kind === 'contradiction'
      ? [...new Set(affected)].flatMap(cell => digitsOf(g.values[cell] ? bit(g.values[cell]) : g.cands[cell]).map(digit => ({ cell, digit, role: 'support' as const })))
      : kind === 'backtrack' ? affected.flatMap(cell => digitsOf(g.cands[cell] & ~(previous?.candidates[cell] ?? 0)).map(digit => ({ cell, digit, role: 'restored' as const })))
      : placements.map(({cell, digit}) => ({cell, digit, role: 'pattern' as const})));
    result.frames.push({ candidateHighlights: marks, relatedCells: [...new Set([...affected, ...(strictInequalities?.flat() ?? [])])], ...(p.variant === 'missing' ? { bulbEnds: [...(bulbs.get(g) ?? p.thermos.map(() => null))] } : {}), title, description, values: [...g.values], candidates: [...g.cands], kind, placements, eliminations, ...(strictInequalities ? { strictInequalities } : {}) });
  };
  const credit = (name: string, score: number, level: Level) => {
    result.score += score; result.techniques[name] = (result.techniques[name] ?? 0) + 1;
    const rank = LEVELS.indexOf(level), current = LEVELS.indexOf(result.level);
    if (rank > current || (rank === current && score > hardestWeight)) { result.level = level; result.hardest = name; hardestWeight = score; }
  };
  function search(g: Grid): Grid | null {
    if (!bulbs.has(g)) bulbs.set(g, p.thermos.map(() => null));
    const state = runLogical(g, p, deadline, {
      bulb: (index, cell) => {
        const info = TECHS.BULB_FINDING; credit(info.name, info.score, info.level);
        const path = p.thermos[index];
        add(g, 'bulb', info.name, bulbFindingDescription(path, cell, index), [], [], undefined, path);
        result.frames.at(-1)!.bulbFinding = { path: [...path], bulb: cell, rejected: cell === path[0] ? path.at(-1)! : path[0] };
      },
      slow: deduction => {
        const info = TECHS.SLOW_THERMOMETER_BOUNDS;
        const name = deduction.strict ? info.name : 'Thermometer bounds';
        const pairs: [number, number][] | undefined = deduction.strict
          ? deduction.chain.slice(1).map((c, i) => [deduction.chain[i], c]) : undefined;
        add(g, 'thermo', name, slowBoundsDescription(deduction), [], deduction.eliminations, pairs, deduction.chain);
        credit(name, info.score, info.level);
      },
      thermo: removed => {
        add(g, 'thermo', 'Thermometer bounds', `Remove ${removed.length} candidates incompatible with strictly increasing thermometer order. Grey marks remain possible; crossed red marks were removed.`, [], removed, undefined, p.thermos.filter(path => removed.some(e => path.includes(e.cell))).flat());
        credit('Thermometer bounds', 5, 'Easy');
      },
      step: step => {
        const info = TECHS[step.tech]; credit(info.name, info.score, info.level);
        add(g, 'logic', info.name, step.description, step.placements, step.eliminations, undefined, techniqueCells(step), techniqueCandidates(step));
        result.frames.at(-1)!.relatedUnits = [...new Set((step.units ?? []).map(band => band.unit))];
      },
    }, bulbs.get(g)!);
    if (state === 'solved') return g;
    if (state === 'contradiction') {
      add(g, 'contradiction', 'Contradiction', 'This trial leaves no legal completion: Sudoku candidates or thermometer order cannot be satisfied.'); return null;
    }
    if (!allowBruteForce) throw new LogicalSolveStalled();
    let cell = -1, count = 10;
    for (let c = 0; c < 81; c++) if (!g.values[c] && popcount(g.cands[c]) < count) { cell = c; count = popcount(g.cands[c]); }
    const digits = digitsOf(g.cands[cell]);
    for (const d of digits) {
      const next = cloneGrid(g); bulbs.set(next, [...bulbs.get(g)!]); setValue(next, cell, d); result.guesses++;
      credit('Brute force', 10000, 'Extreme');
      add(next, 'guess', 'Brute force', `No supported logical technique applies. Try ${cellName(cell)} = ${d} from candidates ${digits.join(', ')}. This is an assumption, not a deduction.`, [{ cell, digit: d }]);
      const completed = search(next); if (completed) return completed;
      result.backtracks++;
      add(g, 'backtrack', 'Restore previous position', `The trial ${cellName(cell)} = ${d} cannot be completed. Undo that branch and try the next candidate.`);
    }
    return null;
  }
  const grid = gridFromValues(p.givens);
  add(grid, 'start', 'Starting puzzle', 'Begin with the original givens. The small digits show remaining candidates; no solution digits have been revealed.');
  const solved = search(grid); if (!solved) throw new Error('This puzzle has no solution walkthrough.');
  add(solved, 'finish', 'Puzzle complete', 'Every row, column, box, and thermometer satisfies the rules. The walkthrough has reached a valid completion.');
  let level = LEVELS.indexOf(result.level);
  while (level < LEVELS.length - 1 && result.score > LEVEL_MAX_SCORE[LEVELS[level]]) level++;
  result.level = LEVELS[level]; return result;
}
