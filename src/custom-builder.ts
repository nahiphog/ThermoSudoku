import { blank, sharedBulb, validatePuzzle, type Puzzle } from './puzzle';
import { compileConstraints, createUniquenessChecker, validCompletion } from './fast-solver';
import { fillCells } from './generator';
import { emptyGrid } from './vendor/sudokui/board';
import { analyze, type Analysis } from './walkthrough';
import { checkLogical } from './logical-runner';

export interface CustomBuildResult { puzzle: Puzzle; solution: number[]; analysis: Analysis }

/** Keep the supplied geometry, then remove clues only when uniqueness is proved. */
export function buildCustom(input: Puzzle, progress: (text: string) => void = () => {}, random = Math.random, budgetMs = 30_000): CustomBuildResult {
  const layout = validatePuzzle(input);
  if (!layout.thermos.length) throw new Error('Place at least one thermometer before building.');
  if (layout.noGivens && layout.variant === 'missing' && !layout.thermos.some(t => sharedBulb(layout.thermos, t, layout.branching))) throw new Error('Missing Thermometer needs given cells: without them, complementing every digit produces another solution. Turn off No given cells or choose another variant.');
  const puzzle = blank(layout.variant);
  puzzle.thermos = layout.thermos.map(path => [...path]);
  puzzle.symmetricThermos = false; puzzle.symmetricGivens = false;
  puzzle.noOverlap = false; puzzle.noThermoGivens = false; puzzle.logicalOnly = layout.logicalOnly ?? true;
  puzzle.branching = layout.branching ?? false;
  puzzle.noGivens = layout.noGivens ?? false;
  const deadline = performance.now() + budgetMs;
  const timeout = () => new Error('Build time limit reached. Try Build again or adjust your thermometers. Your layout is unchanged.');
  const constraints = compileConstraints(puzzle.thermos, puzzle.variant, puzzle.branching);
  if (puzzle.variant === 'slow' && !constraints.repeats.length) throw new Error('Slow Thermo needs an equal consecutive pair. Add a step between cells that do not share a row, column, or box.');
  progress('Finding a completed Sudoku for your exact thermometer layout…');
  const cells = Array.from({ length: 81 }, (_, i) => i);
  const complete = fillCells(emptyGrid(), puzzle, cells, random, deadline, true, constraints);
  if (!complete) {
    if (performance.now() >= deadline) throw timeout();
    throw new Error('These thermometers cannot form a valid puzzle. Adjust the paths and try again.');
  }
  const solution = [...complete.values];
  if (!validCompletion(solution, puzzle.thermos, puzzle.variant, puzzle.branching)) throw new Error('Could not verify the completed grid.');
  puzzle.givens = puzzle.noGivens ? Array(81).fill(0) : [...solution];
  const checker = createUniquenessChecker(puzzle, solution);
  // Prefer blank thermometer cells, without rejecting a user's fixed layout if
  // a clue on a thermometer is necessary to distinguish solutions.
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const occupied = new Set(puzzle.thermos.flat());
  cells.sort((a, b) => Number(occupied.has(b)) - Number(occupied.has(a)));
  if (puzzle.noGivens) progress('Checking whether your thermometers alone determine exactly one solution…');
  for (const [index, cell] of (puzzle.noGivens ? [] : cells).entries()) {
    if (performance.now() >= deadline) throw timeout();
    progress(`Building your puzzle: checking clue ${index + 1} of 81…`);
    const old = puzzle.givens[cell]; puzzle.givens[cell] = 0;
    const result = checker.check(puzzle.givens, deadline);
    if (!result.exhausted) throw timeout();
    if (!result.unique) puzzle.givens[cell] = old;
    else if (puzzle.logicalOnly) {
      // Keep a clue if removing it would require guessing. The geometry stays fixed.
      puzzle.values = [...puzzle.givens];
      if (!checkLogical(puzzle, deadline)) puzzle.givens[cell] = old;
    }
  }
  const verified = checker.check(puzzle.givens, deadline, false);
  if (!verified.exhausted) throw timeout();
  if (!verified.unique) throw new Error(puzzle.noGivens ? 'Your thermometer layout has more than one solution without given cells. Add or adjust thermometers, or turn off No given cells.' : 'Could not verify a unique puzzle. Try Build again.');
  puzzle.values = [...puzzle.givens];
  if (puzzle.noGivens && puzzle.logicalOnly && !checkLogical(puzzle, deadline)) throw new Error('This layout has a unique solution, but the supported logical techniques cannot complete it without Brute force. Adjust the thermometers or turn off Logical techniques only.');
  progress('Calculating difficulty and recording the solution walkthrough…');
  const analysis = analyze(puzzle, Math.max(0, deadline - performance.now()), !puzzle.logicalOnly);
  if (puzzle.logicalOnly && analysis.guesses) throw new Error('Could not certify a solution without Brute force. Try Build again.');
  if (analysis.frames.at(-1)!.values.some((value, cell) => value !== solution[cell])) throw new Error('Walkthrough did not match the verified solution.');
  return { puzzle: validatePuzzle(puzzle), solution, analysis };
}
