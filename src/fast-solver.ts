import { missingSupports } from './missing-thermometer';
import { hasRepeatedStep, validatePuzzle, type Puzzle, type Variant } from './puzzle';
import { ALL_CANDS, bit, digitsOf, PEERS, popcount, UNITS } from './vendor/sudokui/board';

// Support sets for x < y and x <= y, indexed by the other cell's domain.
const less = new Uint16Array(512), greater = new Uint16Array(512);
const atMost = new Uint16Array(512), atLeast = new Uint16Array(512);
for (let mask = 1; mask < 512; mask++) {
  const ds = digitsOf(mask), lo = ds[0], hi = ds[ds.length - 1];
  less[mask] = (1 << (hi - 1)) - 1; atMost[mask] = (1 << hi) - 1;
  greater[mask] = ALL_CANDS & ~((1 << lo) - 1); atLeast[mask] = ALL_CANDS & ~((1 << (lo - 1)) - 1);
}
interface Link { other: number; forward: boolean; equal: boolean }
export interface CompiledConstraints {
  links: Link[][];
  repeats: [number, number][];
  slow: boolean;
  missing: number[][];
}
export function compileConstraints(thermos: number[][], variant: Variant): CompiledConstraints {
  const links: Link[][] = Array.from({ length: 81 }, () => []), repeats: [number, number][] = [];
  for (const path of variant === 'missing' ? [] : thermos) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], equal = variant === 'slow' && !PEERS[a].includes(b);
    links[a].push({ other: b, forward: true, equal }); links[b].push({ other: a, forward: false, equal });
    if (equal) repeats.push([a, b]);
  }
  if (variant === 'slow') for (const path of thermos) for (let i = 0; i < path.length; i++) for (let j = i + 2; j < path.length; j++) {
    const a = path[i], b = path[j];
    if (PEERS[a].includes(b)) {
      links[a].push({ other: b, forward: true, equal: false });
      links[b].push({ other: a, forward: false, equal: false });
    }
  }
  return { links, repeats, slow: variant === 'slow', missing: variant === 'missing' ? thermos : [] };
}

/** Every cell, including a fixed cell, has a nonempty domain. Changed cells
 * drive peer/thermometer propagation; unit scans add hidden singles. No guesses
 * or uniqueness-dependent deductions occur here. */
export function propagateDomains(domains: Uint16Array, compiled: CompiledConstraints): boolean {
  const queue = Array.from({ length: 81 }, (_, c) => c), queued = new Uint8Array(81).fill(1);
  let head = 0;
  const narrow = (c: number, mask: number) => {
    const next = domains[c] & mask;
    if (!next) return false;
    if (next !== domains[c]) { domains[c] = next; if (!queued[c]) { queued[c] = 1; queue.push(c); } }
    return true;
  };
  while (true) {
    while (head < queue.length) {
      const c = queue[head++]; queued[c] = 0; const mask = domains[c];
      if (!mask) return false;
      if (!(mask & (mask - 1))) for (const peer of PEERS[c]) if (!narrow(peer, ALL_CANDS ^ mask)) return false;
      for (const edge of compiled.links[c]) {
        const support = edge.forward ? (edge.equal ? atLeast[mask] : greater[mask]) : (edge.equal ? atMost[mask] : less[mask]);
        if (!narrow(edge.other, support)) return false;
      }
    }
    for (const unit of UNITS) for (let digit = 1; digit <= 9; digit++) {
      const b = bit(digit); let only = -1;
      for (const c of unit) if (domains[c] & b) { if (only !== -1) { only = -2; break; } only = c; }
      if (only === -1) return false;
      if (only >= 0 && !narrow(only, b)) return false;
    }
    for (const path of compiled.missing) {
      const support = missingSupports(domains, path);
      for (let i = 0; i < path.length; i++) if (!narrow(path[i], support.union[i])) return false;
    }
    if (head === queue.length) break;
  }
  return !compiled.slow || compiled.repeats.some(([a, b]) => (domains[a] & domains[b]) !== 0);
}

export function validCompletion(values: number[], thermos: number[][], variant: Variant): boolean {
  return values.length === 81 && values.every(d => Number.isInteger(d) && d >= 1 && d <= 9)
    && UNITS.every(unit => new Set(unit.map(c => values[c])).size === 9)
    && thermos.every(path => path.every((c, i) => i === 0 || (variant === 'slow' ? values[path[i - 1]] <= values[c] : values[path[i - 1]] < values[c])) || (variant === 'missing' && path.every((c, i) => i === 0 || values[path[i - 1]] > values[c])))
    && (variant !== 'slow' || hasRepeatedStep(values, thermos));
}

function search(values: number[], compiled: CompiledConstraints, deadline: number, known?: number[]) {
  const result = { solutions: [] as number[][], exhausted: true, nodes: 0 };
  const root = new Uint16Array(81);
  for (let c = 0; c < 81; c++) root[c] = values[c] ? bit(values[c]) : ALL_CANDS;
  const limit = known ? 1 : 2;
  function visit(domains: Uint16Array) {
    if (!result.exhausted || result.solutions.length >= limit) return;
    if (performance.now() >= deadline) { result.exhausted = false; return; }
    result.nodes++;
    if (!propagateDomains(domains, compiled)) return;
    let cell = -1, size = 10;
    for (let c = 0; c < 81; c++) { const n = popcount(domains[c]); if (n > 1 && n < size) { cell = c; size = n; } }
    if (cell === -1) {
      const complete = Array.from(domains, m => 32 - Math.clz32(m));
      if (!known || complete.some((d, c) => d !== known[c])) result.solutions.push(complete);
      return;
    }
    const digits = digitsOf(domains[cell]);
    // Look for a counterexample first, but eventually explore every branch.
    if (known) digits.sort((a, b) => Number(a === known[cell]) - Number(b === known[cell]));
    for (const d of digits) { const next = domains.slice(); next[cell] = bit(d); visit(next); }
  }
  visit(root); return result;
}

/** Independent counter used for differential testing and imported positions. */
export function fastSolve(input: Puzzle, budgetMs = Infinity) {
  const p = validatePuzzle(input);
  return search(p.values, compileConstraints(p.thermos, p.variant), performance.now() + budgetMs);
}

/** Scope is one immutable layout and known completion. Exact clue-mask results
 * are reusable only within this scope. Every search rebuilds candidate domains. */
export function createUniquenessChecker(p: Puzzle, completion: number[]) {
  if (!validCompletion(completion, p.thermos, p.variant)) throw new Error('Invalid reference completion.');
  const known = [...completion], compiled = compileConstraints(p.thermos, p.variant);
  const cache = new Map<string, boolean>();
  let calls = 0, hits = 0, nodes = 0;
  return {
    metrics: () => ({ calls, hits, nodes }),
    check(givens: number[], deadline = Infinity, useCache = true): { unique: boolean; exhausted: boolean } {
      if (givens.length !== 81 || givens.some((d, c) => d !== 0 && d !== known[c])) throw new Error('Clues do not match the reference completion.');
      calls++;
      const key = givens.map(d => d ? '1' : '0').join('');
      if (performance.now() >= deadline) return { unique: false, exhausted: false };
      if (useCache && cache.has(key)) { hits++; return { unique: cache.get(key)!, exhausted: true }; }
      const r = search(givens, compiled, deadline, known); nodes += r.nodes;
      const unique = r.exhausted && r.solutions.length === 0;
      if (r.exhausted) { if (cache.size >= 2048) cache.delete(cache.keys().next().value!); cache.set(key, unique); }
      return { unique, exhausted: r.exhausted };
    },
  };
}
