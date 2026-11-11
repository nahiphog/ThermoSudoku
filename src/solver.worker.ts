import { hint, solve } from './solver';
import type { Puzzle } from './puzzle';
import { generateDetailed } from './generator';
self.onmessage = (event: MessageEvent<{ type: 'hint' | 'solve' | 'check' | 'generate'; puzzle: Puzzle }>) => {
  try { self.postMessage({ type: event.data.type, result: event.data.type === 'generate' ? generateDetailed(event.data.puzzle.variant, event.data.puzzle, progress => self.postMessage({ progress })) : event.data.type === 'hint' ? hint(event.data.puzzle) : solve(event.data.puzzle) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
