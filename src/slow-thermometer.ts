import { bit, cellName, PEERS, type Grid } from './vendor/sudokui/board';

/** Nondecreasing order plus Sudoku peers implies a strict inequality between
 * ANY ordered peer pair on a path, even if intervening cells are not peers.
 * Iteration combines those inequalities into longer strict chains. */
export function applySlowThermometerBounds(g: Grid, paths: number[][]): boolean {
  const domain = (c: number) => g.values[c] ? bit(g.values[c]) : g.cands[c];
  let changed = true;
  while (changed) {
    changed = false;
    for (const path of paths) for (let i = 0; i < path.length; i++) for (let j = i + 1; j < path.length; j++) {
      const a = path[i], b = path[j], strict = PEERS[a].includes(b);
      // Adjacent weak links provide transitivity; extra links are needed only for peers.
      if (j !== i + 1 && !strict) continue;
      const da = domain(a), db = domain(b);
      if (!da || !db) return false;
      const minA = 32 - Math.clz32(da & -da), maxB = 32 - Math.clz32(db);
      const ma = da & ((1 << (maxB - Number(strict))) - 1);
      const mb = db & (511 ^ ((1 << (minA - 1 + Number(strict))) - 1));
      if (!ma || !mb) return false;
      if (!g.values[a] && ma !== g.cands[a]) { g.cands[a] = ma; changed = true; }
      if (!g.values[b] && mb !== g.cands[b]) { g.cands[b] = mb; changed = true; }
    }
  }
  return true;
}

export function slowThermometerBoundsDescription(paths: number[][], affected: number[]): string {
  const relevant = paths.filter(path => path.some(c => affected.includes(c)));
  const details = relevant.map(path => {
    const strict: string[] = [];
    for (let i = 0; i < path.length; i++) for (let j = i + 1; j < path.length; j++) {
      if (PEERS[path[i]].includes(path[j])) strict.push(`${cellName(path[i])} < ${cellName(path[j])}`);
    }
    return `${path.map(cellName).join(' ≤ ')}.${strict.length ? ` Strict peer relationships: ${strict.join(', ')}.` : ''}`;
  });
  return `Digits cannot decrease along a Slow Thermo. Any two cells on its path that share a row, column, or box must differ, so the earlier digit is strictly smaller—even when the cells are not consecutive. Combine these bounds in both directions to remove unsupported candidates. ${details.join(' ')}`;
}
