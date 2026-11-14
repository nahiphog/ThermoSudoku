import { expect, it, vi } from 'vitest';
import { TECHS } from './techniques';
import { repertoire } from './techniques-page';
import { nextLogicalStep } from './solver';
import { emptyGrid } from './vendor/sudokui/board';

vi.mock('./vendor/sudokui/techniques/fish', async importOriginal => ({
  ...await importOriginal<typeof import('./vendor/sudokui/techniques/fish')>(),
  findFinnedFish: () => { throw new Error('Disabled fish finder must never run'); },
}));

it('disables finned and sashimi fish and excludes them from the Techniques page', () => {
  const keys = ['FINNED_X_WING', 'SASHIMI_X_WING', 'FINNED_SWORDFISH', 'SASHIMI_SWORDFISH', 'FINNED_JELLYFISH', 'SASHIMI_JELLYFISH'] as const;
  for (const key of keys) {
    expect(TECHS[key].enabled).toBe(false);
    expect(repertoire.some(info => info.name === TECHS[key].name)).toBe(false);
  }
  expect(nextLogicalStep(emptyGrid())).toBeNull();
  for (const name of ['X-Wing', 'Swordfish', 'Jellyfish']) {
    expect(repertoire.some(info => info.name === name)).toBe(true);
  }
});
