import { displayBulbs } from './missing-thermometer';
import type { Puzzle } from './puzzle';
import type { Frame } from './walkthrough';
import { cellContents } from './cell-contents';

export function board(p: Puzzle, values: number[], differences: number[] = [], frame?: Frame): string {
  const reasonCells = new Set([...(frame?.relatedCells ?? []), ...(frame?.strictInequalities?.flat() ?? [])]);
  const paths = thermometerMarkup(p, values, frame?.bulbEnds);
  return `<svg class="thermo-overlay" viewBox="0 0 900 900" aria-hidden="true">${paths}</svg><div class="cells">${values.map((d, c) => {
    const classes = ['cell', reasonCells.has(c) ? 'step-reason' : '', bulbHighlight(frame, c), p.givens[c] ? 'given' : '', c % 9 === 2 || c % 9 === 5 ? 'box-right' : '', Math.floor(c / 9) === 2 || Math.floor(c / 9) === 5 ? 'box-bottom' : '', differences.includes(c) ? 'different-cell' : '', frame?.placements.some(e => e.cell === c) ? 'step-placement' : '', frame?.eliminations.some(e => e.cell === c) ? 'step-elimination' : ''];
    return `<div class="${classes.join(' ')}" role="img" aria-label="Row ${Math.floor(c / 9) + 1}, column ${c % 9 + 1}, ${d || 'empty'}${differences.includes(c) ? ', differs between solutions' : ''}${reasonCells.has(c) ? ', relevant to this step' : ''}">${cellContents(d, c, frame)}</div>`;
  }).join('')}</div>`;
}

export function thermometerMarkup(p: Puzzle, values: number[], known?: (number | null)[]): string {
  const point = (c: number) => String(c % 9 * 100 + 50) + ',' + String(Math.floor(c / 9) * 100 + 50);
  const bulbs = displayBulbs(p, values, known);
  return p.thermos.map((t, i) => '<g><polyline points="' + t.map(point).join(' ') + '"/>' + (bulbs[i] === null ? '' : '<circle cx="' + (bulbs[i]! % 9 * 100 + 50) + '" cy="' + (Math.floor(bulbs[i]! / 9) * 100 + 50) + '" r="34"/>') + '</g>').join('');
}

export function bulbHighlight(frame: Frame | null | undefined, cell: number): string {
  const finding = frame?.bulbFinding;
  if (!finding?.path.includes(cell)) return '';
  return cell === finding.bulb ? 'bulb-found' : cell === finding.rejected ? 'bulb-rejected' : 'bulb-path';
}
