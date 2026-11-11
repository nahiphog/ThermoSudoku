import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const seeded = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const results = [];
try {
  const { generateDetailed } = await server.ssrLoadModule('/src/generator.ts');
  const { DEFAULT_GENERATION } = await server.ssrLoadModule('/src/puzzle.ts');
  for (const variant of ['thermo', 'slow']) for (const logicalOnly of [false, true]) for (const preset of [
    { name: 'default', seed: 7, symmetricThermos: true, thermometerCount: 6, minThermoLength: 3 },
    { name: 'asymmetric', seed: 91, symmetricThermos: false, thermometerCount: 5, minThermoLength: 3 },
    { name: 'longer', seed: 11, symmetricThermos: true, thermometerCount: 4, minThermoLength: 4 },
  ]) {
    const options = { ...DEFAULT_GENERATION, ...preset, logicalOnly };
    const start = performance.now();
    try {
      const r = generateDetailed(variant, options, () => {}, seeded(preset.seed), 30000, { diggingOrders: Number(process.argv[3] ?? 2) });
      results.push({ variant, logicalOnly, preset: preset.name, seed: preset.seed, ms: performance.now() - start, stats: r.stats, score: r.analysis.score, guesses: r.analysis.guesses });
    } catch (e) { results.push({ variant, logicalOnly, preset: preset.name, seed: preset.seed, ms: performance.now() - start, error: String(e) }); }
    console.log(JSON.stringify(results.at(-1)));
  }
  const output = { diggingOrders: Number(process.argv[3] ?? 2), node: process.version, benchmarkBudgetMs: 30000, results };
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(output, null, 2) + '\n');
} finally { await server.close(); }
