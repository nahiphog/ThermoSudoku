import { bit, cellName, digitsOf, PEERS, type Grid } from './vendor/sudokui/board';
import type { CellDigit } from './vendor/sudokui/steps';

export interface SlowBoundsDeduction {
  chain: number[];
  strict: boolean;
  eliminations: CellDigit[];
}

/** Long strict chains first; include every peer edge as a fallback so splitting
 * the explanation never weakens the fixed-point propagation. */
function chainsFor(path: number[]): number[][] {
  const longest: number[][] = path.map(c => [c]);
  for (let i = path.length - 1; i >= 0; i--) for (let j = i + 1; j < path.length; j++) {
    if (PEERS[path[i]].includes(path[j]) && longest[j].length + 1 > longest[i].length) longest[i] = [path[i], ...longest[j]];
  }
  const chains = longest.filter(c => c.length > 1).sort((a, b) => b.length - a.length);
  for (let i = 0; i < path.length; i++) for (let j = i + 1; j < path.length; j++) {
    if (PEERS[path[i]].includes(path[j])) chains.push([path[i], path[j]]);
  }
  return [...new Map(chains.map(c => [c.join(','), c])).values()];
}

/** Emit only after applying one productive chain. Each snapshot therefore
 * contains precisely that chain's eliminations, never future deductions. */
export function applySlowThermometerBounds(g: Grid, paths: number[][], emit?: (deduction: SlowBoundsDeduction) => void): boolean {
  const domain = (c: number) => g.values[c] ? bit(g.values[c]) : g.cands[c];
  const deductions = paths.flatMap(path => [
    ...chainsFor(path).map(chain => ({ chain, strict: true })),
    ...path.slice(1).flatMap((c, i) => PEERS[path[i]].includes(c) ? [] : [{ chain: [path[i], c], strict: false }]),
  ]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { chain, strict } of deductions) {
      const before = chain.map(domain), masks = [...before];
      let narrowed = true;
      while (narrowed) {
        narrowed = false;
        for (let i = 1; i < chain.length; i++) {
          const da = masks[i - 1], db = masks[i]; if (!da || !db) return false;
          const minA = 32 - Math.clz32(da & -da), maxB = 32 - Math.clz32(db);
          const ma = da & ((1 << (maxB - Number(strict))) - 1);
          const mb = db & (511 ^ ((1 << (minA - 1 + Number(strict))) - 1));
          if (!ma || !mb) return false;
          if (ma !== da || mb !== db) narrowed = true;
          masks[i - 1] = ma; masks[i] = mb;
        }
      }
      const eliminations: CellDigit[] = [];
      for (let i = 0; i < chain.length; i++) if (!g.values[chain[i]] && masks[i] !== before[i]) {
        g.cands[chain[i]] = masks[i]; changed = true;
        if (emit) for (const digit of digitsOf(before[i] & ~masks[i])) eliminations.push({ cell: chain[i], digit });
      }
      if (eliminations.length) emit!({ chain: [...chain], strict, eliminations });
    }
  }
  return true;
}

export function slowBoundsDescription(deduction: SlowBoundsDeduction): string {
  const { chain, strict, eliminations } = deduction;
  const relationship = chain.map(cellName).join(strict ? ' < ' : ' ≤ ');
  const removals = [...new Set(eliminations.map(e => e.cell))].map(c =>
    cellName(c) + ': remove ' + eliminations.filter(e => e.cell === c).map(e => e.digit).join(', '));
  return relationship + '. ' + (strict
    ? 'Digits cannot decrease along the thermometer. Each consecutive pair in this chain shares a row, column, or box, so those digits must strictly increase, even if other thermometer cells lie between them. '
    : 'These consecutive thermometer cells may be equal, but the later digit cannot be smaller. ')
    + 'Using the current candidates in this chain: ' + removals.join('; ') + '.';
}
