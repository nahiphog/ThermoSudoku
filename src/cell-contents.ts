import { bit } from './vendor/sudokui/board';
import type { Frame } from './walkthrough';

/** One renderer for Generate and Import: emphasize only recorded evidence,
 * and never reintroduce an absent candidate unless this step eliminated it. */
export function cellContents(value: number, cell: number, frame?: Frame | null): string {
  const highlights = new Map((frame?.candidateHighlights ?? []).filter(h => h.cell === cell).map(h => [h.digit, h.role]));
  if (value) {
    const role = highlights.get(value);
    return `<span class="digit${role ? ` candidate-${role}` : ''}">${value}</span>`;
  }
  if (!frame) return '';
  const removed = new Set(frame.eliminations.filter(e => e.cell === cell).map(e => e.digit));
  return `<span class="pencil">${Array.from({ length: 9 }, (_, i) => {
    const digit = i + 1, eliminated = removed.has(digit);
    if (!eliminated && !(frame.candidates[cell] & bit(digit))) return '<span></span>';
    const role = highlights.get(digit);
    const label = eliminated ? 'eliminated' : role === 'support' ? 'supporting' : role === 'fin' ? 'fin' : role === 'restored' ? 'restored' : role === 'pattern' ? 'pattern' : 'possible';
    const className = eliminated ? 'removed-candidate' : role ? `candidate-${role}` : '';
    return `<span class="${className}" data-digit="${digit}" title="${digit}: ${label}" aria-label="Candidate ${digit}, ${label}">${digit}</span>`;
  }).join('')}</span>`;
}
