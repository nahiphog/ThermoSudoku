import { ALL_CANDS, bit, cellName, type Grid } from './vendor/sudokui/board';
import type { Puzzle } from './puzzle';

// Supports for a complete strictly increasing chain, never independent edge flips.
function increasing(domains: number[]): number[] | null {
  const support = [...domains];
  for (let i = 1; i < support.length; i++) {
    const previous = support[i - 1];
    if (!previous) return null;
    const minimum = 32 - Math.clz32(previous & -previous);
    support[i] &= ALL_CANDS & ~((1 << minimum) - 1);
  }
  for (let i = support.length - 2; i >= 0; i--) {
    const next = support[i + 1];
    if (!next) return null;
    const maximum = 32 - Math.clz32(next);
    support[i] &= (1 << (maximum - 1)) - 1;
  }
  return support.every(Boolean) ? support : null;
}
export function missingSupports(domains: ArrayLike<number>, path: number[]) {
  const masks = path.map(c => domains[c]);
  const forward = increasing(masks);
  const reverse = increasing([...masks].reverse())?.reverse() ?? null;
  return { forward, reverse, union: masks.map((_, i) => (forward?.[i] ?? 0) | (reverse?.[i] ?? 0)) };
}
export function gridDomains(g: Grid): number[] {
  return Array.from(g.values, (v, c) => v ? bit(v) : g.cands[c]);
}
export function bulbFindingDescription(path: number[], cell: number, index: number): string {
  const other = cell === path[0] ? path.at(-1)! : path[0];
  return `Thermometer ${index + 1}: place the bulb at ${cellName(cell)}. Starting at ${cellName(other)} cannot form a strictly increasing sequence using the current digits and candidates; only the direction from ${cellName(cell)} to ${cellName(other)} remains possible. The green outlined cell is the bulb, the red dashed cell is the ruled-out end, and the connecting path is highlighted.`;
}
export function displayBulbs(p: Puzzle, values: number[], known?: (number | null)[]): (number | null)[] {
  if (p.variant !== 'missing') return p.thermos.map(t => t[0]);
  if (known) return known;
  if (!values.every(v => v > 0)) return p.thermos.map(() => null);
  return p.thermos.map(t => values[t[0]] < values[t.at(-1)!] ? t[0] : t.at(-1)!);
}
