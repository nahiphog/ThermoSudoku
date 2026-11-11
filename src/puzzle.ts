export type Variant = 'thermo' | 'slow';
export interface Puzzle { version: 1; values: number[]; givens: number[]; thermos: number[][]; variant: Variant; noThermoGivens: boolean }
export const adjacent = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / 9) - Math.floor(b / 9)) <= 1 && Math.abs(a % 9 - b % 9) <= 1;
export function blank(variant: Variant = 'thermo', noThermoGivens = true): Puzzle { return { version: 1, values: Array(81).fill(0), givens: Array(81).fill(0), thermos: [], variant, noThermoGivens }; }
export function validatePuzzle(input: unknown): Puzzle {
  const p = input as Puzzle;
  if (!p || p.version !== 1) throw new Error('Unsupported puzzle format. Expected version 1.');
  if (p.variant !== undefined && !['thermo', 'slow'].includes(p.variant)) throw new Error('Unknown thermometer variant.');
  if (p.noThermoGivens !== undefined && typeof p.noThermoGivens !== 'boolean') throw new Error('Invalid generation setting.');
  const variant = p.variant ?? 'thermo';
  for (const values of [p.values, p.givens]) {
    if (!Array.isArray(values) || values.length !== 81 || values.some(v => !Number.isInteger(v) || v < 0 || v > 9)) throw new Error('A grid must contain exactly 81 digits from 0 to 9.');
  }
  if (p.givens.some((v, i) => v !== 0 && v !== p.values[i])) throw new Error('A given must match the digit in its cell.');
  if (!Array.isArray(p.thermos) || p.thermos.length > 100) throw new Error('Expected at most 100 thermometers.');
  for (const t of p.thermos) {
    if (!Array.isArray(t) || t.length < 2 || t.length > (variant === 'slow' ? 81 : 9) || new Set(t).size !== t.length || t.some(c => !Number.isInteger(c) || c < 0 || c > 80) || t.some((c, i) => i > 0 && !adjacent(t[i - 1], c))) throw new Error(`Thermometers need 2–${variant === 'slow' ? 81 : 9} distinct, adjacent cells, starting at the bulb.`);
  }
  return structuredClone({ ...p, variant, noThermoGivens: p.noThermoGivens ?? true });
}
export const hasRepeatedStep = (values: ArrayLike<number>, thermos: number[][]) => thermos.some(t => t.some((c, i) => i > 0 && values[c] !== 0 && values[c] === values[t[i - 1]]));
export function example(): Puzzle {
  const p = blank();
  p.values = [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(Number);
  p.givens = [...p.values];
  p.thermos = [[7, 8, 17], [11, 10, 20], [32, 31, 30], [75, 66, 57], [78, 79, 80]];
  return p;
}
