import { blank, validatePuzzle, type Puzzle, type Variant } from './puzzle';
import { decodePuzzle } from './puzzle-string';
import { solve, type SolveResult } from './solver';
import { analyze, type Analysis } from './walkthrough';

export function parseImport(text: string, variant?: Variant): Puzzle {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const p = validatePuzzle({ ...JSON.parse(trimmed), ...(variant ? { variant } : {}) }); p.values = [...p.givens]; return p;
  }
  // Accept a copied token on its own or embedded in a message.
  const tokens = trimmed.match(/TS1\|[^\s<>"`]+/g);
  if (tokens) {
    if (tokens.length !== 1) throw new Error('Paste just one puzzle string.');
    return decodePuzzle(tokens[0], variant);
  }
  const digits = trimmed.replace(/\s/g, '');
  if (/^[0-9.]{81}$/.test(digits)) {
    const p = blank(variant); p.givens = [...digits].map(d => d === '.' ? 0 : Number(d)); p.values = [...p.givens]; return p;
  }
  throw new Error('Paste a TS1 puzzle string, puzzle JSON, or 81 digits (0 or . for empty cells).');
}

export interface ImportResult extends SolveResult { analysis?: Analysis; analysisError?: string }
export function checkImported(p: Puzzle, budgetMs = 30000): ImportResult {
  const result: ImportResult = solve({ ...p, values: [...p.givens] }, budgetMs);
  if (result.exhausted && result.solutions.length === 1) {
    try { result.analysis = analyze({ ...p, values: [...p.givens] }, budgetMs); }
    catch (error) { result.analysisError = error instanceof Error ? error.message : String(error); }
  }
  return result;
}
