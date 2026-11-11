import { parseImport, type ImportResult } from './import-check';
import type { Puzzle } from './puzzle';
import type { Frame } from './walkthrough';
import { digitsOf } from './vendor/sudokui/board';

function board(p: Puzzle, values: number[], differences: number[] = [], frame?: Frame): string {
  const point = (c: number) => `${c % 9 * 100 + 50},${Math.floor(c / 9) * 100 + 50}`;
  const paths = p.thermos.map(t => `<g><polyline points="${t.map(point).join(' ')}"/><circle cx="${t[0] % 9 * 100 + 50}" cy="${Math.floor(t[0] / 9) * 100 + 50}" r="34"/></g>`).join('');
  return `<svg class="thermo-overlay" viewBox="0 0 900 900" aria-hidden="true">${paths}</svg><div class="cells">${values.map((d, c) => {
    const removed = frame?.eliminations.filter(e => e.cell === c).map(e => e.digit) ?? [];
    const candidates = frame ? digitsOf(frame.candidates[c]) : [];
    const marks = Array.from({ length: 9 }, (_, i) => `<span class="${removed.includes(i + 1) ? 'removed-candidate' : ''}">${removed.includes(i + 1) || candidates.includes(i + 1) ? i + 1 : ''}</span>`).join('');
    const classes = ['cell', p.givens[c] ? 'given' : '', c % 9 === 2 || c % 9 === 5 ? 'box-right' : '', Math.floor(c / 9) === 2 || Math.floor(c / 9) === 5 ? 'box-bottom' : '', differences.includes(c) ? 'different-cell' : '', frame?.placements.some(e => e.cell === c) ? 'step-placement' : ''];
    return `<div class="${classes.join(' ')}" role="img" aria-label="Row ${Math.floor(c / 9) + 1}, column ${c % 9 + 1}, ${d || 'empty'}${differences.includes(c) ? ', differs between solutions' : ''}">${d ? `<span class="digit">${d}</span>` : frame ? `<span class="pencil">${marks}</span>` : ''}</div>`;
  }).join('')}</div>`;
}

export function mountImportPage() {
  const page = document.createElement('main'); page.id = 'import-page'; page.hidden = true;
  page.innerHTML = `<section class="card"><h1>Import grid</h1><p>Paste a copied puzzle string, including one inside a message, or puzzle JSON. You can also paste 81 Sudoku digits (0 or . for blanks); digits alone contain no thermometers.</p><label for="import-text">Puzzle string</label><textarea id="import-text" spellcheck="false"></textarea><div class="button-pair"><button id="inspect-import" class="primary">Check uniqueness</button><button id="stop-import" class="outline" hidden>Cancel check</button></div><p id="import-status" role="status" aria-live="polite"></p></section><div id="import-results"></div>`;
  document.querySelector('#maker-page')!.after(page);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => page.querySelector<T>(id)!;
  let worker: Worker | null = null;
  const stop = () => { worker?.terminate(); worker = null; $<HTMLButtonElement>('#inspect-import').disabled = false; $('#stop-import').hidden = true; };
  const clear = () => { stop(); $('#import-results').innerHTML = ''; $('#import-status').textContent = ''; };
  const route = () => {
    const active = location.hash === '#import-grid'; page.hidden = !active; (document.querySelector('#maker-page') as HTMLElement).hidden = active;
    document.querySelectorAll<HTMLAnchorElement>('.page-nav a').forEach(a => { if (a.hash === (active ? '#import-grid' : '#maker')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (!active && worker) { stop(); $('#import-status').textContent = 'Check canceled.'; }
  };
  window.addEventListener('hashchange', route); route();
  $('#import-text').addEventListener('input', clear);
  $('#stop-import').onclick = () => { stop(); $('#import-status').textContent = 'Check canceled. No uniqueness conclusion was reached.'; };
  $('#inspect-import').onclick = () => {
    clear(); let p: Puzzle;
    try { p = parseImport($<HTMLTextAreaElement>('#import-text').value); }
    catch (error) { $('#import-status').textContent = error instanceof Error ? error.message : String(error); return; }
    $<HTMLButtonElement>('#inspect-import').disabled = true; $('#stop-import').hidden = false;
    $('#import-status').textContent = 'Checking uniqueness and preparing the walkthrough…';
    const current = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' }); worker = current;
    current.onerror = () => { if (worker !== current) return; stop(); $('#import-status').textContent = 'The check could not finish. Please try again.'; };
    current.onmessage = event => {
      if (worker !== current) return; stop();
      if (event.data.error) { $('#import-status').textContent = event.data.error; return; }
      const result = event.data.result as ImportResult, target = $('#import-results');
      if (result.solutions.length >= 2) {
        const differences = result.solutions[0].flatMap((d, c) => d !== result.solutions[1][c] ? [c] : []);
        $('#import-status').textContent = `Multiple solutions. These two valid completions differ in ${differences.length} cells, highlighted in amber with an outline.`;
        target.innerHTML = `<div class="import-columns">${result.solutions.slice(0, 2).map((values, i) => `<section class="card"><h2>Solution ${i + 1}</h2><div class="board" aria-label="Solution ${i + 1}">${board(p, values, differences)}</div></section>`).join('')}</div>`;
        return;
      }
      if (!result.exhausted) { $('#import-status').textContent = 'Search limit reached. Uniqueness is undetermined; try checking again.'; return; }
      if (!result.solutions.length) { $('#import-status').textContent = 'No solution exists under the supplied Sudoku and thermometer rules.'; return; }
      $('#import-status').textContent = 'Exactly one solution.';
      target.innerHTML = `<div class="import-columns"><section class="card"><h2>Completed grid</h2><div id="import-completed" class="board" aria-label="Completed grid">${board(p, result.solutions[0])}</div></section><section class="card"><h2>Solution walkthrough</h2><div id="import-walk-content"></div></section></div>`;
      if (!result.analysis) { $('#import-walk-content').textContent = `The solution is verified, but the walkthrough could not finish. ${result.analysisError ?? ''} Check again to retry.`; return; }
      const analysis = result.analysis; let index = 0;
      $('#import-walk-content').innerHTML = `<p id="import-rating"></p><div id="import-walk-board" class="board" aria-label="Walkthrough grid"></div><p id="import-step-count"></p><h3 id="import-step-title"></h3><p id="import-step-description" aria-live="polite"></p><input id="import-step-range" type="range" min="0" max="${analysis.frames.length - 1}" value="0" aria-label="Imported solution step"><div class="button-pair"><button id="import-prev" class="outline">Previous step</button><button id="import-next" class="primary">Next step</button></div><div class="button-pair"><button id="import-first" class="text-button">Starting puzzle</button><button id="import-last" class="text-button">Completed step</button></div><p class="muted">Purple: placed digit. Red crossed marks: eliminated candidates. Trials and rollbacks are labeled.</p>`;
      $('#import-rating').textContent = `Difficulty rating: ${analysis.score} (estimated). Hardest technique: ${analysis.hardest}.`;
      const renderStep = () => {
        const frame = analysis.frames[index]; $('#import-walk-board').innerHTML = board(p, frame.values, [], frame);
        $('#import-step-count').textContent = `Step ${index + 1} of ${analysis.frames.length}`;
        $('#import-step-title').textContent = frame.title; $('#import-step-description').textContent = frame.description;
        $<HTMLInputElement>('#import-step-range').value = String(index);
        $<HTMLButtonElement>('#import-prev').disabled = index === 0; $<HTMLButtonElement>('#import-next').disabled = index === analysis.frames.length - 1;
      };
      $('#import-prev').onclick = () => { index = Math.max(0, index - 1); renderStep(); };
      $('#import-next').onclick = () => { index = Math.min(analysis.frames.length - 1, index + 1); renderStep(); };
      $('#import-first').onclick = () => { index = 0; renderStep(); };
      $('#import-last').onclick = () => { index = analysis.frames.length - 1; renderStep(); };
      $<HTMLInputElement>('#import-step-range').oninput = e => { index = Number((e.target as HTMLInputElement).value); renderStep(); };
      renderStep();
    };
    current.postMessage({ type: 'import-check', puzzle: p });
  };
}
