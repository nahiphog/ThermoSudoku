import { generateDetailed } from './generator';
import type { Puzzle } from './puzzle';

// One request per trial provides backpressure while the page stores each match.
self.onmessage = (event: MessageEvent<{ puzzle: Puzzle; threshold: number }>) => {
  try {
    const result = generateDetailed(event.data.puzzle.variant, event.data.puzzle);
    self.postMessage({ score: result.analysis.score, match: result.analysis.score >= event.data.threshold
      ? { puzzle: result.puzzle, score: result.analysis.score, hardest: result.analysis.hardest }
      : null });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
