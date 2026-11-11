export type Variant = 'thermo' | 'slow';
export interface GenerationOptions { symmetricGivens: boolean; symmetricThermos: boolean; noOverlap: boolean; thermometerCount?: number; minThermoLength?: number }
export const DEFAULT_GENERATION: GenerationOptions = { symmetricGivens: true, symmetricThermos: true, noOverlap: true, thermometerCount: 6, minThermoLength: 3 };
export const MIN_THERMO_LENGTH = 3;
export interface Puzzle extends GenerationOptions { version: 1; values: number[]; givens: number[]; thermos: number[][]; variant: Variant; noThermoGivens: boolean }
export const adjacent = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / 9) - Math.floor(b / 9)) <= 1 && Math.abs(a % 9 - b % 9) <= 1;
export function blank(variant: Variant = 'thermo', noThermoGivens = true): Puzzle { return { version: 1, values: Array(81).fill(0), givens: Array(81).fill(0), thermos: [], variant, noThermoGivens, ...DEFAULT_GENERATION }; }
export function validatePuzzle(input: unknown): Puzzle {
  const p = input as Puzzle;
  if (!p || p.version !== 1) throw new Error('Unsupported puzzle format. Expected version 1.');
  if (p.variant !== undefined && !['thermo', 'slow'].includes(p.variant)) throw new Error('Unknown thermometer variant.');
  if (p.noThermoGivens !== undefined && typeof p.noThermoGivens !== 'boolean') throw new Error('Invalid generation setting.');
  for (const key of ['symmetricGivens', 'symmetricThermos', 'noOverlap'] as const) if (p[key] !== undefined && typeof p[key] !== 'boolean') throw new Error('Invalid generation setting.');
  for (const [value, max] of [[p.thermometerCount, 30], [p.minThermoLength, 11]] as const) if (value !== undefined && (!Number.isInteger(value) || value < (max === 30 ? 1 : 2) || value > max)) throw new Error('Invalid thermometer count or minimum length.');
  const variant = p.variant ?? 'thermo';
  for (const values of [p.values, p.givens]) {
    if (!Array.isArray(values) || values.length !== 81 || values.some(v => !Number.isInteger(v) || v < 0 || v > 9)) throw new Error('A grid must contain exactly 81 digits from 0 to 9.');
  }
  if (p.givens.some((v, i) => v !== 0 && v !== p.values[i])) throw new Error('A given must match the digit in its cell.');
  if (!Array.isArray(p.thermos) || p.thermos.length > 100) throw new Error('Expected at most 100 thermometers.');
  for (const t of p.thermos) {
    if (!Array.isArray(t) || t.length < 2 || t.length > (variant === 'slow' ? 81 : 9) || new Set(t).size !== t.length || t.some(c => !Number.isInteger(c) || c < 0 || c > 80) || t.some((c, i) => i > 0 && !adjacent(t[i - 1], c))) throw new Error(`Thermometers need 2–${variant === 'slow' ? 81 : 9} distinct, adjacent cells, starting at the bulb.`);
  }
  return structuredClone({ thermometerCount: 6, minThermoLength: 3, ...p, variant, noThermoGivens: p.noThermoGivens ?? true, symmetricGivens: p.symmetricGivens ?? true, symmetricThermos: p.symmetricThermos ?? true, noOverlap: p.noOverlap ?? true });
}
export const hasRepeatedStep = (values: ArrayLike<number>, thermos: number[][]) => thermos.some(t => t.some((c, i) => i > 0 && values[c] !== 0 && values[c] === values[t[i - 1]]));
export function example(): Puzzle {
  const p = blank();
  p.values = [...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(Number);
  p.givens = [...p.values];
  p.thermos = [[7, 8, 17], [11, 10, 20], [32, 31, 30], [75, 66, 57], [78, 79, 80]];
  return p;
}

export function generationError(variant: Variant, options: GenerationOptions): string | null {
  const count = options.thermometerCount ?? 6, length = options.minThermoLength ?? 3;
  if (!Number.isInteger(count) || count < 1 || count > 30 || !Number.isInteger(length) || length < 2 || length > 11) return 'Choose 1–30 thermometers and a minimum length of 2–11 cells.';
  if (variant === 'thermo' && length > 9) return 'Strict Thermo supports at most 9 cells. Choose Slow Thermo for longer paths.';
  if (count * length > 81) return count + ' non-overlapping thermometers of ' + length + '+ cells need at least ' + count * length + ' cells; the grid has 81.';
  if (options.symmetricThermos && count % 2) return 'Choose an even thermometer count or turn off rotational thermometer symmetry.';
  return null;
}
