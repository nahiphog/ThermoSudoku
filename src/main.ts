import './style.css';
import { blank, example, validatePuzzle, type Puzzle } from './puzzle';
import { conflicts, type SolveResult } from './solver';
import { gridImage } from './grid-image';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let puzzle = example(), solution: number[] | null = null, revealed = false, selected = 0;
let worker: Worker | null = null, busy: 'generate' | 'check' | 'solve' | null = null;
let status = 'Ready to generate.', detail = 'Choose your puzzle options above the grid.';
try {
  const saved = localStorage.getItem('thermo-studio-v1');
  if (saved) puzzle = validatePuzzle(JSON.parse(saved));
  puzzle.values = [...puzzle.givens];
} catch { /* Storage is optional. */ }

$('#app').innerHTML = `
<header class="topbar"><a class="brand" href="./" aria-label="Thermo home"><img class="brand-icon" src="${import.meta.env.BASE_URL}thermometer.svg" width="32" height="32" alt=""> thermo<span class="brand-dot">.</span></a><a class="source-link" href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">Built with sudokUI ↗</a></header>
<main>
  <section class="card settings-card" aria-label="Puzzle options">
    <div class="settings-heading"><h1>Puzzle options</h1><div class="mode-switch" aria-label="Thermometer variant"><button id="thermo-variant">Thermo</button><button id="slow-variant">Slow Thermo</button></div></div>
    <div class="generation-options">
      <label><input id="no-thermo-givens" type="checkbox"> No givens on thermometers</label>
      <label><input id="symmetric-givens" type="checkbox"> Rotationally symmetric givens</label>
      <label><input id="symmetric-thermos" type="checkbox"> Rotationally symmetric thermometers</label>
      <label><input id="no-overlap" type="checkbox"> No overlapping or branching thermometers</label>
    </div>
    <div class="generate-row"><p class="muted">Settings apply to the next generated puzzle. Symmetry is a 180° rotation. Each thermometer has at least 3 cells, including its bulb.</p><button id="generate" class="primary">Generate puzzle</button></div>
  </section>
  <div class="workspace">
    <section class="board-panel" aria-label="Sudoku workspace">
      <div class="board-heading"><strong id="puzzle-title">Thermo Sudoku</strong><span id="view-label">Puzzle</span></div>
      <div id="board" class="board" role="group" aria-label="Thermo Sudoku grid"><svg id="thermos" viewBox="0 0 900 900" aria-hidden="true"></svg><div id="cells" class="cells"></div></div>
      <div class="board-footer"><span id="filled"></span><span>Manual entry disabled</span></div>
      <div id="grid-actions" class="button-pair"><button id="copy-image" class="outline">Copy grid as an image</button><button id="reveal" class="primary">Reveal solution</button></div>
    </section>
    <aside>
      <section class="card solver-card"><h2>Puzzle check</h2><div id="status" role="status" aria-live="polite"><strong id="status-title"></strong><p id="status-detail"></p></div><button id="check" class="outline full">Check puzzle</button><button id="cancel" class="text-button full" hidden>Cancel</button></section>
      <section class="rules"><div class="rules-icon">i</div><div><h3>The rules are simple.</h3><p id="variant-rules"></p><p class="rule-note">Thermometers can turn, including diagonally.</p></div></section>
    </aside>
  </div>
  <section class="bottom-actions"><div><button id="new" class="text-button">＋ New puzzle</button><button id="example" class="text-button">Load example</button></div><div><button id="import" class="text-button">↓ Import</button><button id="export" class="text-button">↑ Export</button></div></section>
  <footer><span>Made for curious minds.</span><span>Thermo Sudoku · GPL-3.0 · <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">sudokUI techniques</a></span></footer>
</main>
<dialog id="transfer"><form method="dialog"><div class="dialog-heading"><h2 id="transfer-title">Import puzzle</h2><button aria-label="Close dialog" class="text-button">✕</button></div></form><p id="transfer-help"></p><textarea id="puzzle-json" spellcheck="false" aria-label="Puzzle JSON"></textarea><p id="import-error" role="alert"></p><button id="load-json" class="primary full">Import puzzle</button><button id="download" class="primary full" hidden>Download JSON</button></dialog>
<dialog id="confirm"><h2 id="confirm-title"></h2><p>This replaces the current puzzle.</p><div class="button-pair"><button id="confirm-no" class="outline">Keep puzzle</button><button id="confirm-yes" class="primary">Continue</button></div></dialog>`;

const cells = Array.from({ length: 81 }, (_, i) => {
  const b = document.createElement('button'); b.className = 'cell'; b.dataset.cell = String(i);
  if (i % 9 === 2 || i % 9 === 5) b.classList.add('box-right');
  if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) b.classList.add('box-bottom');
  b.onclick = () => { selected = i; render(); };
  $('#cells').append(b); return b;
});
const settings = {
  'no-thermo-givens': 'noThermoGivens', 'symmetric-givens': 'symmetricGivens',
  'symmetric-thermos': 'symmetricThermos', 'no-overlap': 'noOverlap',
} as const;
function save() { try { localStorage.setItem('thermo-studio-v1', JSON.stringify(puzzle)); } catch { /* Storage is optional. */ } }
function cancel() { worker?.terminate(); worker = null; busy = null; }
function message(title: string, body: string) { status = title; detail = body; }
function replace(next: Puzzle) {
  cancel(); puzzle = next; puzzle.values = [...puzzle.givens]; solution = null; revealed = false; save(); render();
}
const visibleValues = () => revealed && solution ? solution : puzzle.givens;
function render() {
  const values = visibleValues(), bad = conflicts({ ...puzzle, values });
  cells.forEach((b, i) => {
    b.classList.toggle('selected', i === selected); b.classList.toggle('given', !!puzzle.givens[i]); b.classList.toggle('conflict', bad.has(i));
    b.tabIndex = i === selected ? 0 : -1;
    b.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}${puzzle.givens[i] ? ', given' : ''}`);
    b.setAttribute('aria-pressed', String(i === selected));
    b.innerHTML = values[i] ? `<span class="digit">${values[i]}</span>` : '';
  });
  const point = (c: number) => `${c % 9 * 100 + 50},${Math.floor(c / 9) * 100 + 50}`;
  $('#thermos').innerHTML = puzzle.thermos.map(t => `<g><polyline points="${t.map(point).join(' ')}"/><circle cx="${t[0] % 9 * 100 + 50}" cy="${Math.floor(t[0] / 9) * 100 + 50}" r="34"/></g>`).join('');
  $('#filled').textContent = `${values.filter(Boolean).length} / 81 filled · ${puzzle.thermos.length} thermometers`;
  $('#puzzle-title').textContent = puzzle.variant === 'slow' ? 'Slow Thermo Sudoku' : 'Thermo Sudoku';
  $('#view-label').textContent = revealed ? 'Solution' : 'Puzzle';
  $('#status-title').textContent = busy === 'generate' ? 'Generating your puzzle…' : busy ? 'Checking every constraint…' : status;
  $('#status-detail').textContent = busy ? 'Looking for exactly one solution with your selected rules.' : detail;
  for (const [id, key] of Object.entries(settings)) { $<HTMLInputElement>(`#${id}`).checked = puzzle[key]; $<HTMLInputElement>(`#${id}`).disabled = !!busy; }
  for (const v of ['thermo', 'slow'] as const) {
    const b = $<HTMLButtonElement>(`#${v}-variant`); b.classList.toggle('active', puzzle.variant === v); b.setAttribute('aria-pressed', String(puzzle.variant === v)); b.disabled = !!busy;
  }
  $('#variant-rules').textContent = puzzle.variant === 'slow' ? 'Normal sudoku rules apply. Starting at the bulb, digits along each Slow Thermo must increase or stay the same. At least one thermometer must have an equal consecutive pair in the completed grid.' : 'Normal sudoku rules apply. Starting at the bulb, digits along each thermometer must strictly increase.';
  for (const id of ['generate', 'check', 'reveal', 'copy-image']) $<HTMLButtonElement>(`#${id}`).disabled = !!busy;
  $('#grid-actions').hidden = !puzzle.givens.some(Boolean) && !puzzle.thermos.length;
  $('#reveal').textContent = revealed ? 'Hide solution' : 'Reveal solution';
  $('#reveal').setAttribute('aria-pressed', String(revealed));
  $('#cancel').hidden = !busy;
}
for (const [id, key] of Object.entries(settings)) $<HTMLInputElement>(`#${id}`).onchange = e => {
  puzzle[key] = (e.target as HTMLInputElement).checked; save(); message('Generation options updated.', 'These settings apply when you generate your next puzzle.'); render();
};
for (const v of ['thermo', 'slow'] as const) $(`#${v}-variant`).onclick = () => {
  if (puzzle.variant === v) return;
  if (v === 'thermo' && puzzle.thermos.some(t => t.length > 9)) { message('This path is too long for strict Thermo.', 'Start a new puzzle before switching variants.'); render(); return; }
  puzzle.variant = v; solution = null; revealed = false; save(); message('Variant updated.', 'Generate a puzzle with the selected rules.'); render();
};
window.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || ['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key) || ['Backspace', 'Delete'].includes(e.key)) { e.preventDefault(); return; }
  const moves: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (e.key in moves) { e.preventDefault(); selected = (selected + moves[e.key] + 81) % 81; render(); cells[selected].focus(); }
});
function run(type: 'check' | 'solve' | 'generate') {
  if (busy) return;
  busy = type; render(); worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  worker.onerror = () => { cancel(); message('Could not complete the request.', 'Please try again.'); render(); };
  worker.onmessage = event => {
    cancel();
    if (event.data.error) { message('Could not complete the request.', event.data.error); render(); return; }
    if (type === 'generate') {
      replace(validatePuzzle(event.data.result));
      message('A new puzzle, with one solution.', 'Your generation settings are satisfied. Copy the grid or reveal its solution below.');
    } else {
      const r = event.data.result as SolveResult;
      if (r.exhausted && r.solutions.length === 1) {
        solution = r.solutions[0]; if (type === 'solve') revealed = true;
        message('Exactly one solution.', revealed ? 'Hide solution restores the original puzzle without changing its givens.' : 'Every Sudoku and thermometer constraint checks out.');
      } else {
        solution = null; revealed = false;
        message(r.solutions.length > 1 ? 'More than one solution.' : !r.exhausted ? 'Search limit reached.' : 'No solution exists.', 'A solution is revealed only when uniqueness is verified. Try generating a new puzzle.');
      }
    }
    render();
  };
  worker.postMessage({ type, puzzle: { ...puzzle, values: [...puzzle.givens] } });
}
function confirmChange(title: string, action: () => void) {
  $('#confirm-title').textContent = title; $<HTMLDialogElement>('#confirm').showModal();
  $('#confirm-yes').onclick = () => { $<HTMLDialogElement>('#confirm').close(); action(); };
}
$('#confirm-no').onclick = () => $<HTMLDialogElement>('#confirm').close();
$('#generate').onclick = () => confirmChange('Generate a new puzzle?', () => run('generate'));
$('#check').onclick = () => run('check');
$('#reveal').onclick = () => {
  if (revealed) { revealed = false; render(); }
  else if (solution) { revealed = true; render(); }
  else run('solve');
};
$('#cancel').onclick = () => { cancel(); message('Canceled.', 'Your current puzzle is unchanged.'); render(); };
$('#new').onclick = () => confirmChange('Start a new puzzle?', () => {
  const next = blank(puzzle.variant, puzzle.noThermoGivens);
  for (const key of Object.values(settings)) next[key] = puzzle[key];
  replace(next); message('Ready to generate.', 'Choose your options and generate a puzzle.'); render();
});
$('#example').onclick = () => confirmChange('Load the example puzzle?', () => { replace(example()); message('Example loaded.', 'This fixed example predates the new generation settings.'); render(); });
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#copy-image').onclick = async () => {
  const png = gridImage(puzzle, [...visibleValues()]);
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Clipboard images unavailable');
    // Pass the promise immediately to preserve the user's activation in Safari.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    message('Grid image copied.', 'Paste the PNG into a message or document. It matches the currently visible grid.');
  } catch {
    try { download(await png, 'thermo-sudoku.png'); message('Grid image downloaded.', 'Clipboard access was unavailable. The same PNG was saved as a file instead.'); }
    catch { message('Could not create the grid image.', 'Please try again in a browser with canvas support.'); }
  }
  render();
};
function transfer(exporting: boolean) {
  $('#transfer-title').textContent = exporting ? 'Export puzzle' : 'Import puzzle';
  $('#transfer-help').textContent = exporting ? 'Includes givens, thermometer paths, and generation preferences. Revealing the solution never changes the exported puzzle.' : 'Paste a Thermo Sudoku JSON puzzle. Import replaces the current puzzle.';
  $<HTMLTextAreaElement>('#puzzle-json').value = exporting ? JSON.stringify(puzzle, null, 2) : '';
  $<HTMLTextAreaElement>('#puzzle-json').readOnly = exporting;
  $('#load-json').hidden = exporting; $('#download').hidden = !exporting; $('#import-error').textContent = '';
  $<HTMLDialogElement>('#transfer').showModal();
}
$('#import').onclick = () => transfer(false); $('#export').onclick = () => transfer(true);
$('#load-json').onclick = () => {
  try { replace(validatePuzzle(JSON.parse($<HTMLTextAreaElement>('#puzzle-json').value))); $<HTMLDialogElement>('#transfer').close(); message('Puzzle imported.', 'Check the puzzle or reveal its solution.'); render(); }
  catch (e) { $('#import-error').textContent = e instanceof Error ? e.message : 'Invalid puzzle JSON.'; }
};
$('#download').onclick = () => download(new Blob([JSON.stringify(puzzle, null, 2)], { type: 'application/json' }), 'thermo-sudoku.json');
render();
