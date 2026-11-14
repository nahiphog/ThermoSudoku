import { bit, PEERS, UNITS, type Grid } from './vendor/sudokui/board';
import type { Step } from './techniques';
import type { Puzzle } from './puzzle';
import { gridDomains, missingSupports } from './missing-thermometer';

/** Use the finder's evidence, not cell names parsed out of prose. */
export function techniqueCells(step: Step): number[] {
  return [...new Set([
    ...[step.placements, step.eliminations, step.primary, step.secondary, step.fins, step.copyOnly].flatMap(list => (list ?? []).map(p => p.cell)),
    ...(step.units ?? []).flatMap(band => UNITS[band.unit]),
    ...(step.chainCells ?? []),
    ...(step.links ?? []).flatMap(link => [...link.from, ...link.to].map(p => p.cell)),
    ...(step.sets ?? []).flatMap(set => set.cells),
    ...(step.walk?.frames ?? []).flatMap(frame => frame.cells ?? []),
  ])].sort((a, b) => a - b);
}

export function contradictionCells(g: Grid, p: Puzzle): number[] {
  const cells = new Set<number>(), domains = gridDomains(g);
  for (let c = 0; c < 81; c++) {
    if (!domains[c]) cells.add(c);
    if (g.values[c]) for (const peer of PEERS[c]) if (g.values[c] === g.values[peer]) { cells.add(c); cells.add(peer); }
  }
  for (const unit of UNITS) for (let d = 1; d <= 9; d++) {
    if (!unit.some(c => domains[c] & bit(d))) unit.forEach(c => cells.add(c));
  }
  for (const path of p.thermos) {
    let impossible = false;
    if (p.variant !== 'slow') {
      const support = missingSupports(domains, path);
      impossible = !support.forward && (p.variant !== 'missing' || !support.reverse);
    } else {
      for (let i = 0; i < path.length; i++) for (let j = i + 1; j < path.length; j++) {
        const a = domains[path[i]], b = domains[path[j]];
        const minimum = 32 - Math.clz32(a & -a), maximum = 32 - Math.clz32(b);
        if (!a || !b || minimum + Number(PEERS[path[i]].includes(path[j])) > maximum) impossible = true;
      }
    }
    if (impossible) path.forEach(c => cells.add(c));
  }
  if (p.variant === 'slow' && !p.thermos.some(t => t.some((c, i) => i > 0 && !PEERS[c].includes(t[i - 1]) && (domains[c] & domains[t[i - 1]])))) {
    p.thermos.flat().forEach(c => cells.add(c));
  }
  return [...cells].sort((a, b) => a - b);
}
