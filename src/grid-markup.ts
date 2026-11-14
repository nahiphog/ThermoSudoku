import { displayBulbs } from './missing-thermometer';
import type { Puzzle } from './puzzle';
import type { Frame } from './walkthrough';
import { cellContents } from './cell-contents';

export function board(p: Puzzle, values: number[], differences: number[] = [], frame?: Frame): string {
  const reasonCells = new Set([...(frame?.relatedCells ?? []), ...(frame?.strictInequalities?.flat() ?? [])]);
  const paths = thermometerMarkup(p, values, frame?.bulbEnds);
  return `${unitArrows(frame)}<svg class="thermo-overlay" viewBox="0 0 900 900" aria-hidden="true">${paths}</svg><div class="cells">${values.map((d, c) => {
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

/** Rows/columns use outside arrows; boxes use a single perimeter outline. */
export function unitArrows(frame?: Frame | null): string {
  const units = [...new Set(frame?.relatedUnits ?? [])].filter(u => u >= 0 && u < 27);
  if (!frame) return '';
  return '<div class="unit-arrows">' + units.map(u => {
    if (u >= 18) {
      const box = u - 18;
      return '<span class="unit-box-outline" role="img" aria-label="Box ' + (box + 1) + ' involved" style="left:' + ((box % 3) * 100 / 3) + '%;top:' + (Math.floor(box / 3) * 100 / 3) + '%"></span>';
    }
    const row = u < 9, n = row ? u : u - 9;
    return '<span class="unit-arrow ' + (row ? 'row-arrow' : 'column-arrow') + '" role="img" aria-label="' + (row ? 'Row ' : 'Column ') + (n + 1) + ' involved" style="' + (row ? 'top' : 'left') + ':' + ((n + .5) * 100 / 9) + '%">' + (row ? '→' : '↓') + '</span>';
  }).join('') + '</div>';
}
