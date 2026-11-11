import { conflicts } from './solver';
import { runLogical } from './logical-runner';
import { hasRepeatedStep, type Puzzle } from './puzzle';
import { bit, cellName, cloneGrid, digitsOf, gridFromValues, isSolved, popcount, setValue, type Grid } from './vendor/sudokui/board';
import { LEVELS, LEVEL_MAX_SCORE, TECHS, type Level } from './vendor/sudokui/ratings';
import type { CellDigit } from './vendor/sudokui/steps';

export interface Frame { title: string; description: string; values: number[]; candidates: number[]; placements: CellDigit[]; eliminations: CellDigit[]; kind: 'start' | 'logic' | 'thermo' | 'guess' | 'contradiction' | 'backtrack' | 'finish' }
export interface Analysis { frames: Frame[]; score: number; level: Level; hardest: string; guesses: number; backtracks: number; techniques: Record<string, number> }
/** A replay of the actual solving process, including failed trials and rollback.
 * This is an estimate: upstream technique weights + 5 per thermo reduction +
 * 10000 per Brute force use. Trials always force Extreme, never masquerade as deductions. */
export class LogicalSolveStalled extends Error { constructor() { super('The supported logical techniques cannot complete this puzzle without Brute force.'); } }
export function analyze(p: Puzzle, budgetMs = 10000, allowBruteForce = true): Analysis {
  const result: Analysis = { frames: [], score: 0, level: 'Easy', hardest: 'None', guesses: 0, backtracks: 0, techniques: {} };
  const deadline = performance.now() + budgetMs;
  let hardestWeight = -1;
  if (conflicts(p).size) throw new Error('Cannot analyze a contradictory puzzle.');
  const add = (g: Grid, kind: Frame['kind'], title: string, description: string, placements: CellDigit[] = [], eliminations: CellDigit[] = []) => {
    if (result.frames.length >= 20000 || performance.now() >= deadline) throw new Error('Analysis budget reached before a complete walkthrough was recorded. Try generating again.');
    result.frames.push({ title, description, values: [...g.values], candidates: [...g.cands], kind, placements, eliminations });
  };
  const credit = (name: string, score: number, level: Level) => {
    result.score += score; result.techniques[name] = (result.techniques[name] ?? 0) + 1;
    const rank = LEVELS.indexOf(level), current = LEVELS.indexOf(result.level);
    if (rank > current || (rank === current && score > hardestWeight)) { result.level = level; result.hardest = name; hardestWeight = score; }
  };
  function search(g: Grid): Grid | null {
    const state = runLogical(g, p, deadline, {
      thermo: removed => {
        add(g, 'thermo', 'Thermometer bounds', `Remove ${removed.length} candidates incompatible with ${p.variant === 'slow' ? 'nondecreasing' : 'strictly increasing'} thermometer order. Grey marks remain possible; crossed red marks were removed.`, [], removed);
        credit('Thermometer bounds', 5, 'Easy');
      },
      step: step => {
        const info = TECHS[step.tech]; credit(info.name, info.score, info.level);
        add(g, 'logic', info.name, step.description, step.placements, step.eliminations);
      },
    });
    if (state === 'solved') return g;
    if (state === 'contradiction') {
      add(g, 'contradiction', 'Contradiction', 'This trial leaves no legal completion: Sudoku candidates or thermometer order cannot be satisfied.'); return null;
    }
    if (!allowBruteForce) throw new LogicalSolveStalled();
    let cell = -1, count = 10;
    for (let c = 0; c < 81; c++) if (!g.values[c] && popcount(g.cands[c]) < count) { cell = c; count = popcount(g.cands[c]); }
    const digits = digitsOf(g.cands[cell]);
    for (const d of digits) {
      const next = cloneGrid(g); setValue(next, cell, d); result.guesses++;
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
