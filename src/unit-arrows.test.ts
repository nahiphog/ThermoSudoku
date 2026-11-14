import { expect, it } from 'vitest';
import { unitArrows } from './grid-markup';
import type { Frame } from './walkthrough';
it('labels row and column arrows once and leaves box context inside the grid', () => {
  const html = unitArrows({ relatedUnits: [0, 9, 17, 0, 18] } as Frame);
  expect((html.match(/role="img"/g) ?? [])).toHaveLength(4);
  expect(html).toContain('Row 1 involved');
  expect(html).toContain('Column 1 involved');
  expect(html).toContain('Column 9 involved');
  expect(html).toContain('Box 1 involved');
  expect(html).toContain('unit-box-outline');
  expect(unitArrows()).toBe('');
});
