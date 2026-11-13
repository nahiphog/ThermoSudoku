import { bit, cellName, type Grid } from './vendor/sudokui/board';
import type { CellDigit } from './vendor/sudokui/steps';
import type { Step } from './techniques';

export const PHISTOMEFEL_RING = [20, 21, 22, 23, 24, 29, 33, 38, 42, 47, 51, 56, 57, 58, 59, 60];
export const PHISTOMEFEL_CORNERS = [0, 1, 7, 8, 9, 10, 16, 17, 63, 64, 70, 71, 72, 73, 79, 80];

/** Equal multisets imply equal counts for EACH digit, not corresponding cells.
 * Candidate counts are conservative bounds: no uniqueness or variant assumptions.
 * Return one digit's productive deduction per use; never charge for an observation.
 */
export function findPhistomefelRing(g: Grid): Step | null {
  for (let digit = 1; digit <= 9; digit++) {
    const mask = bit(digit);
    const count = (cells: number[]) => {
      let minimum = 0;
      const optional: number[] = [];
      for (const cell of cells) {
        if (g.values[cell] === digit || (!g.values[cell] && g.cands[cell] === mask)) minimum++;
        else if (!g.values[cell] && (g.cands[cell] & mask)) optional.push(cell);
      }
      return { minimum, maximum: minimum + optional.length, optional };
    };
    const ring = count(PHISTOMEFEL_RING), corners = count(PHISTOMEFEL_CORNERS);
    const minimum = Math.max(ring.minimum, corners.minimum);
    const maximum = Math.min(ring.maximum, corners.maximum);
    // Inconsistent states are left to the normal contradiction/search handling.
    if (minimum > maximum) continue;
    const placements: CellDigit[] = [], eliminations: CellDigit[] = [];
    for (const side of [ring, corners]) {
      if (side.minimum === maximum) {
        for (const cell of side.optional) eliminations.push({ cell, digit });
      } else if (side.maximum === minimum) {
        for (const cell of side.optional) placements.push({ cell, digit });
      }
    }
    if (!placements.length && !eliminations.length) continue;
    const actions = [
      placements.length ? `Place ${digit} in ${placements.map(p => cellName(p.cell)).join(', ')}.` : '',
      eliminations.length ? `Remove ${digit} from ${eliminations.map(e => cellName(e.cell)).join(', ')}.` : '',
    ].filter(Boolean).join(' ');
    return {
      tech: 'PHISTOMEFEL_RING', placements, eliminations,
      primary: PHISTOMEFEL_RING.map(cell => ({ cell, digit })),
      secondary: PHISTOMEFEL_CORNERS.map(cell => ({ cell, digit })),
      description: `The 16-cell ring around the central box and the four 2 × 2 corners contain identical digit tallies. For ${digit}, the ring allows ${ring.minimum}–${ring.maximum} occurrences and the corners allow ${corners.minimum}–${corners.maximum}; both must have ${minimum === maximum ? `exactly ${minimum}` : `${minimum}–${maximum}`}. ${actions}`,
    };
  }
  return null;
}
