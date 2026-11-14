import { blank, validatePuzzle, type Puzzle, type Variant } from './puzzle';
// TS1|variant|81 row-major clues (0 = empty)|paths separated by ;
// Each path is a sequence of two-digit row/column coordinates, bulb first.
export function encodePuzzle(p: Puzzle): string {
  return ['TS1', p.variant === 'missing' ? 'M' : p.variant === 'slow' ? 'S' : 'T', p.givens.join(''), p.thermos.map(t => t.map(c => String(Math.floor(c / 9) + 1) + String(c % 9 + 1)).join('')).join(';')].join('|');
}
export function decodePuzzle(text: string, variant?: Variant): Puzzle {
  const parts = text.trim().split('|');
  if (parts.length !== 4 || parts[0] !== 'TS1' || !['T', 'S', 'M'].includes(parts[1]) || !/^[0-9]{81}$/.test(parts[2])) throw new Error('Invalid TS1 puzzle string.');
  const p = blank(variant ?? (parts[1] === 'M' ? 'missing' : parts[1] === 'S' ? 'slow' : 'thermo'));
  p.givens = [...parts[2]].map(Number); p.values = [...p.givens];
  p.thermos = parts[3] ? parts[3].split(';').map(path => {
    if (!/^(?:[1-9]{2}){2,81}$/.test(path)) throw new Error('Invalid thermometer coordinates. Use row/column pairs from 11 to 99.');
    return path.match(/../g)!.map(rc => (Number(rc[0]) - 1) * 9 + Number(rc[1]) - 1);
  }) : [];
  return validatePuzzle(p);
}
