import { expect, it } from 'vitest';
import { cellContents } from './cell-contents';
import { techniqueCandidates } from './walkthrough-highlights';
import { bit } from './vendor/sudokui/board';
import type { Frame } from './walkthrough';

it('preserves candidate roles and leaves unrelated and absent candidates alone', () => {
  const frame: Frame = {
    kind: 'logic', title: 'Pattern', description: '', values: Array(81).fill(0), candidates: Array(81).fill(0), placements: [],
    eliminations: [{cell: 0, digit: 6}],
    candidateHighlights: [
      {cell: 0, digit: 1, role: 'pattern'}, {cell: 0, digit: 2, role: 'support'},
      {cell: 0, digit: 3, role: 'fin'}, {cell: 0, digit: 4, role: 'restored'},
      {cell: 0, digit: 6, role: 'pattern'}, {cell: 0, digit: 9, role: 'support'},
    ],
  };
  frame.candidates[0] = bit(1) | bit(2) | bit(3) | bit(4) | bit(5);
  const html = cellContents(0, 0, frame);
  for (const [digit, role] of [[1,'pattern'],[2,'support'],[3,'fin'],[4,'restored'],[6,'removed-candidate']] as const) {
    expect(html).toContain(`class="${role === 'removed-candidate' ? role : `candidate-${role}`}" data-digit="${digit}"`);
  }
  expect(html).toContain('class="" data-digit="5"');
  expect(html).not.toContain('data-digit="9"');
  expect(cellContents(2, 0, frame)).toContain('digit candidate-support');
  expect(cellContents(0, 0)).toBe('');
  expect(cellContents(0, 1, frame)).not.toContain('candidate-support');
});

it('carries the actual pattern, supporting digits, and fins from logical steps', () => {
  const marks = techniqueCandidates({
    tech: 'FINNED_X_WING', description: '', placements: [], eliminations: [{cell: 10, digit: 7}],
    primary: [{cell: 0, digit: 7}], secondary: [{cell: 1, digit: 7}], fins: [{cell: 2, digit: 7}],
    units: [{unit: 0, role: 'primary'}],
  });
  expect(marks).toEqual(expect.arrayContaining([
    {cell: 0, digit: 7, role: 'pattern'}, {cell: 1, digit: 7, role: 'support'}, {cell: 2, digit: 7, role: 'fin'},
  ]));
  expect(marks).toHaveLength(3); // A highlighted house does not mark all its digits.
});
