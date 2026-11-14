import { hint, solve } from './solver';
import type { Puzzle } from './puzzle';
import { generateDetailed, type GenerationProgress } from './generator';
import { checkImported } from './import-check';
import { buildCustom } from './custom-builder';
self.onmessage = (event: MessageEvent<{ type: 'hint' | 'solve' | 'check' | 'generate' | 'import-check' | 'custom-build'; puzzle: Puzzle }>) => {
  if (event.data.type === 'custom-build') {
    try { self.postMessage({ result: buildCustom(event.data.puzzle, text => self.postMessage({ buildProgress: text })) }); }
    catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
    return;
  }
  if (event.data.type === 'import-check') {
    try { self.postMessage({ result: checkImported(event.data.puzzle) }); }
    catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
    return;
  }
  let lastProgress = -Infinity;
  const emitProgress = (progress: GenerationProgress) => {
    const now = performance.now();
    if (now - lastProgress >= 100) { lastProgress = now; self.postMessage({ progress }); }
  };
  try { self.postMessage({ type: event.data.type, result: event.data.type === 'generate' ? generateDetailed(event.data.puzzle.variant, event.data.puzzle, emitProgress) : event.data.type === 'hint' ? hint(event.data.puzzle) : solve(event.data.puzzle) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
