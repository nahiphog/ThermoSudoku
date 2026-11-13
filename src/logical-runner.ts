import type { SlowBoundsDeduction } from './slow-thermometer';
import { applyLogicalStep, conflicts, nextLogicalStep, propagate } from './solver';
import { hasRepeatedStep, type Puzzle } from './puzzle';
import { digitsOf, gridFromValues, isSolved, type Grid } from './vendor/sudokui/board';
import type { CellDigit } from './vendor/sudokui/steps';
import type { Step } from './techniques';
import { gridDomains, missingSupports } from './missing-thermometer';

/** One technique ordering for both certification and explanatory replay.
 * In check mode no board snapshots or elimination lists are allocated. */
export function runLogical(g: Grid, p: Puzzle, deadline: number, observer?: {
  thermo: (removed: CellDigit[]) => void;
  slow?: (deduction: SlowBoundsDeduction) => void;
  step: (step: Step) => void;
  bulb?: (thermometer: number, cell: number) => void;
}, bulbEnds: (number | null)[] = p.thermos.map(() => null)): 'solved' | 'stalled' | 'contradiction' {
  const findBulbs = () => {
    if (p.variant !== 'missing') return true;
    const domains = gridDomains(g);
    for (const [index, path] of p.thermos.entries()) {
      const support = missingSupports(domains, path);
      if (!support.forward && !support.reverse) return false;
      if (bulbEnds[index] === null && (!!support.forward !== !!support.reverse)) {
        const cell = support.forward ? path[0] : path.at(-1)!;
        bulbEnds[index] = cell; observer?.bulb?.(index, cell);
      }
    }
    return true;
  };
  while (true) {
    if (performance.now() >= deadline) throw new Error('Logical analysis budget reached.');
    if (!findBulbs()) return 'contradiction';
    const before = observer && p.variant !== 'slow' ? [...g.cands] : null;
    if (!propagate(g, p.thermos, p.variant, observer?.slow)) return 'contradiction';
    if (before) {
      const removed = before.flatMap((mask, c) => digitsOf(mask & ~g.cands[c]).map(digit => ({ cell: c, digit })));
      if (removed.length) observer!.thermo(removed);
    }
    if (!findBulbs()) return 'contradiction';
    if (isSolved(g)) return p.variant !== 'slow' || hasRepeatedStep(g.values, p.thermos) ? 'solved' : 'contradiction';
    const step = nextLogicalStep(g);
    if (!step) return 'stalled';
    applyLogicalStep(g, step); observer?.step(step);
  }
}
export function checkLogical(p: Puzzle, deadline = Infinity): number[] | null {
  if (conflicts({ ...p, values: p.givens }).size) return null;
  const g = gridFromValues(p.givens);
  return runLogical(g, p, deadline) === 'solved' ? [...g.values] : null;
}
