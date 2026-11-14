import { TECHS as upstreamTechniques } from './vendor/sudokui/ratings';
import type { Step as UpstreamStep } from './vendor/sudokui/steps';

// App-wide extensions keep the vendored sudokUI catalogue unchanged.
export const TECHS = {
  ...upstreamTechniques,
  // Retain upstream metadata for compatibility, but disable these in the app.
  FINNED_X_WING: { ...upstreamTechniques.FINNED_X_WING, enabled: false },
  SASHIMI_X_WING: { ...upstreamTechniques.SASHIMI_X_WING, enabled: false },
  FINNED_SWORDFISH: { ...upstreamTechniques.FINNED_SWORDFISH, enabled: false },
  SASHIMI_SWORDFISH: { ...upstreamTechniques.SASHIMI_SWORDFISH, enabled: false },
  FINNED_JELLYFISH: { ...upstreamTechniques.FINNED_JELLYFISH, enabled: false },
  SASHIMI_JELLYFISH: { ...upstreamTechniques.SASHIMI_JELLYFISH, enabled: false },
  SLOW_THERMOMETER_BOUNDS: { name: 'Slow Thermometer bounds', score: 5, level: 'Easy' as const, category: 'Thermometers', index: 249, implemented: true, enabled: true },
  BULB_FINDING: { name: 'Bulb finding', score: 10, level: 'Easy' as const, category: 'Missing Thermometer', index: 250, implemented: true, enabled: true },
  PHISTOMEFEL_RING: {
    name: 'Phistomefel Ring', score: 200, level: 'Hard' as const,
    category: 'Set equivalence', index: 4000, implemented: true, enabled: true,
  },
};
export type Tech = keyof typeof TECHS;
export type Step = Omit<UpstreamStep, 'tech'> & { tech: Tech };
