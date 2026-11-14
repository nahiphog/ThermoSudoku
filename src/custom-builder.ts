import { blank, validatePuzzle, type Puzzle } from './puzzle';
import { compileConstraints, createUniquenessChecker, validCompletion } from './fast-solver';
import { fillCells } from './generator';
import { emptyGrid } from './vendor/sudokui/board';
import { analyze, type Analysis } from './walkthrough';

export interface CustomBuildResult { puzzle: Puzzle; solution: number[]; analysis: Analysis }

/** Keep the supplied geometry, then remove clues only when uniqueness is proved. */
export function buildCustom(input: Puzzle, progress: (text: string) => void = () => {}, random = Math.random, budgetMs = 30_000): CustomBuildResult {
  const layout = validatePuzzle(input);
  if (!layout.thermos.length) throw new Error('Place at least one thermometer before building.');
  const puzzle = blank(layout.variant);
  puzzle.thermos = layout.thermos.map(path => [...path]);
  puzzle.symmetricThermos = false; puzzle.symmetricGivens = false;
  puzzle.noOverlap = false; puzzle.noThermoGivens = false; puzzle.logicalOnly = false;
  const deadline = performance.now() + budgetMs;
  const timeout = () => new Error('Build time limit reached. Try Build again or adjust your thermometers. Your layout is unchanged.');
  const constraints = compileConstraints(puzzle.thermos, puzzle.variant);
  if (puzzle.variant === 'slow' && !constraints.repeats.length) throw new Error('Slow Thermo needs an equal consecutive pair. Add a step between cells that do not share a row, column, or box.');
  progress('Finding a completed Sudoku for your exact thermometer layout…');
  const cells = Array.from({ length: 81 }, (_, i) => i);
  const complete = fillCells(emptyGrid(), puzzle, cells, random, deadline, true, constraints);
  if (!complete) {
    if (performance.now() >= deadline) throw timeout();
    throw new Error('These thermometers cannot form a valid puzzle. Adjust the paths and try again.');
  }
  const solution = [...complete.values];
  if (!validCompletion(solution, puzzle.thermos, puzzle.variant)) throw new Error('Could not verify the completed grid.');
  puzzle.givens = [...solution];
  const checker = createUniquenessChecker(puzzle, solution);
  // Prefer blank thermometer cells, without rejecting a user's fixed layout if
  // a clue on a thermometer is necessary to distinguish solutions.
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const occupied = new Set(puzzle.thermos.flat());
  cells.sort((a, b) => Number(occupied.has(b)) - Number(occupied.has(a)));
  for (const [index, cell] of cells.entries()) {
    if (performance.now() >= deadline) throw timeout();
    progress(`Building your puzzle: checking clue ${index + 1} of 81…`);
    const old = puzzle.givens[cell]; puzzle.givens[cell] = 0;
    const result = checker.check(puzzle.givens, deadline);
    if (!result.exhausted) throw timeout();
    if (!result.unique) puzzle.givens[cell] = old;
  }
  const verified = checker.check(puzzle.givens, deadline, false);
  if (!verified.exhausted) throw timeout();
  if (!verified.unique) throw new Error('Could not verify a unique puzzle. Try Build again.');
  puzzle.values = [...puzzle.givens];
  progress('Calculating difficulty and recording the solution walkthrough…');
  const analysis = analyze(puzzle, Math.max(0, deadline - performance.now()));
  if (analysis.frames.at(-1)!.values.some((value, cell) => value !== solution[cell])) throw new Error('Walkthrough did not match the verified solution.');
  return { puzzle: validatePuzzle(puzzle), solution, analysis };
}
