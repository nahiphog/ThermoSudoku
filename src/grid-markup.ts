import type { Puzzle } from './puzzle';
import type { Frame } from './walkthrough';
import { digitsOf } from './vendor/sudokui/board';

export function board(p: Puzzle, values: number[], differences: number[] = [], frame?: Frame): string {
  const point = (c: number) => `${c % 9 * 100 + 50},${Math.floor(c / 9) * 100 + 50}`;
  const paths = p.thermos.map(t => `<g><polyline points="${t.map(point).join(' ')}"/><circle cx="${t[0] % 9 * 100 + 50}" cy="${Math.floor(t[0] / 9) * 100 + 50}" r="34"/></g>`).join('');
  return `<svg class="thermo-overlay" viewBox="0 0 900 900" aria-hidden="true">${paths}</svg><div class="cells">${values.map((d, c) => {
    const removed = frame?.eliminations.filter(e => e.cell === c).map(e => e.digit) ?? [];
    const candidates = frame ? digitsOf(frame.candidates[c]) : [];
    const marks = Array.from({ length: 9 }, (_, i) => `<span class="${removed.includes(i + 1) ? 'removed-candidate' : ''}">${removed.includes(i + 1) || candidates.includes(i + 1) ? i + 1 : ''}</span>`).join('');
    const classes = ['cell', p.givens[c] ? 'given' : '', c % 9 === 2 || c % 9 === 5 ? 'box-right' : '', Math.floor(c / 9) === 2 || Math.floor(c / 9) === 5 ? 'box-bottom' : '', differences.includes(c) ? 'different-cell' : '', frame?.placements.some(e => e.cell === c) ? 'step-placement' : ''];
    return `<div class="${classes.join(' ')}" role="img" aria-label="Row ${Math.floor(c / 9) + 1}, column ${c % 9 + 1}, ${d || 'empty'}${differences.includes(c) ? ', differs between solutions' : ''}">${d ? `<span class="digit">${d}</span>` : frame ? `<span class="pencil">${marks}</span>` : ''}</div>`;
  }).join('')}</div>`;
}
