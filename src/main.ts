import './style.css';
import { adjacent, blank, example, validatePuzzle, type Puzzle } from './puzzle';
import { candidates, conflicts, type Hint, type SolveResult } from './solver';
import { digitsOf } from './vendor/sudokui/board';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let puzzle = example(), tool: 'digit' | 'thermo' | 'erase' = 'digit';
let selected = 0, draft: number[] = [], showCandidates = false, past: string[] = [], future: string[] = [];
let worker: Worker | null = null, busy = false, dragging = false, dragExtended = false;
let hintMasks: number[] | null = null;
let status = 'Your next puzzle starts here.', detail = 'Add givens, draw thermometers, then check your creation.';
try { const saved = localStorage.getItem('thermo-studio-v1'); if (saved) puzzle = validatePuzzle(JSON.parse(saved)); } catch { /* Invalid or unavailable storage never prevents editing. */ }

$('#app').innerHTML = `
  <header class="topbar"><a class="brand" href="./" aria-label="Thermo home"><span class="brand-icon">♨</span> thermo<span class="brand-dot">.</span></a><span class="header-label">SUDOKU STUDIO</span><a class="source-link" href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">Built with sudokUI ↗</a></header>
  <main><div class="intro"><div><div class="eyebrow"><span></span> A CLASSIC, WITH A TWIST</div><h1>A little warmth.<br>A lot of possibility.</h1><p>Create a clever constraint. Follow a new line of logic.</p></div><div class="intro-mark" aria-hidden="true"><svg viewBox="0 0 130 100"><path d="M25 76L57 44L88 44L111 21"/><circle cx="25" cy="76" r="15"/><text x="52" y="86">1 &lt; 2 &lt; 3</text></svg></div></div>
  <div class="workspace"><section class="board-panel" aria-label="Sudoku workspace"><div class="board-heading"><strong>Puzzle maker</strong><span id="board-label">YOUR CANVAS · 9 × 9</span></div>
  <div id="board" class="board" role="group" aria-label="Thermo Sudoku grid"><svg id="thermos" viewBox="0 0 900 900" aria-hidden="true"></svg><div id="cells" class="cells"></div></div>
  <div class="board-footer"><span id="filled"></span><div><button id="undo" class="text-button" title="Undo (Ctrl+Z)">↶ Undo</button><button id="redo" class="text-button" title="Redo (Ctrl+Shift+Z)">↷ Redo</button></div></div>
  <div id="keypad" class="keypad" aria-label="Number pad">${Array.from({ length: 9 }, (_, i) => `<button data-digit="${i + 1}">${i + 1}</button>`).join('')}<button data-digit="0" aria-label="Clear selected cell">⌫</button></div>
  <p class="keyboard-help">Use <kbd>1–9</kbd> to enter digits · <kbd>↑ ↓ ← →</kbd> to move · <kbd>Del</kbd> to erase</p></section>
  <aside><section class="card settings-card"><div class="section-label">PUZZLE OPTIONS</div><div class="mode-switch" aria-label="Thermometer variant"><button id="thermo-variant">Thermo</button><button id="slow-variant">Slow Thermo</button></div><label class="toggle-row"><input id="no-thermo-givens" type="checkbox"><span>No givens on thermometers</span></label><p class="muted">Generation setting. Includes every bulb and path cell. Turn off to allow givens on thermometers.</p><button id="generate" class="primary full">Generate puzzle</button></section><section class="card tools-card"><div class="section-label">01 / THE TOOLKIT</div><h2 id="tool-title">Make it your own.</h2><div class="tool-grid"><button data-tool="digit" class="tool active"><span>1<span class="small-icon">2</span></span>Given digits</button><button data-tool="thermo" class="tool"><span>♧</span>Thermometer</button><button data-tool="erase" class="tool"><span>⌫</span>Erase thermo</button></div><p id="tool-help" class="muted"></p><button id="finish" class="outline full" hidden>Finish thermometer</button><label class="toggle-row"><input id="candidates" type="checkbox"><span>Show candidates</span><span class="tiny-label">AUTO</span></label></section>
  <section class="card solver-card"><div class="section-label">02 / FIND THE LOGIC</div><h2>A nudge, or the answer.</h2><div id="status" role="status" aria-live="polite"><strong id="status-title"></strong><p id="status-detail"></p></div><button id="check" class="primary full">Check puzzle <span>↗</span></button><div class="button-pair"><button id="hint" class="outline">Give me a hint</button><button id="solve" class="outline">Solve puzzle</button></div><button id="cancel" class="text-button full" hidden>Cancel solver</button></section>
  <section class="rules"><div class="rules-icon">i</div><div><h3>The rules are simple.</h3><p id="variant-rules">Normal sudoku rules apply. Starting at the “bulb”, digits placed along each marked thermometer must form a <strong>strictly increasing sequence.</strong></p><p class="rule-note">Thermometers can turn, including diagonally.</p></div></section>
  </aside></div><section class="bottom-actions"><div><button id="new" class="text-button">＋ New puzzle</button><button id="example" class="text-button">Load example</button><button id="reset" class="text-button">Reset entries</button></div><div><button id="import" class="text-button">↓ Import</button><button id="export" class="text-button">↑ Export</button></div></section>
  <footer><span>Made for curious minds.</span><span>Thermo Sudoku · GPL-3.0 · <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">sudokUI techniques</a></span></footer></main>
  <dialog id="transfer"><form method="dialog"><div class="dialog-heading"><h2 id="transfer-title">Import puzzle</h2><button aria-label="Close dialog" class="text-button">✕</button></div></form><p id="transfer-help">Paste a Thermo Sudoku JSON puzzle below.</p><textarea id="puzzle-json" spellcheck="false" aria-label="Puzzle JSON"></textarea><p id="import-error" role="alert"></p><button id="load-json" class="primary full">Import puzzle</button><button id="download" class="primary full" hidden>Download JSON</button></dialog>
  <dialog id="confirm"><h2 id="confirm-title">Start a new puzzle?</h2><p>This replaces the current board. You can undo this change.</p><div class="button-pair"><button id="confirm-no" class="outline">Keep editing</button><button id="confirm-yes" class="primary">Continue</button></div></dialog>`;

document.querySelectorAll<HTMLElement>('.tool > span').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
$('.tool[data-tool="thermo"] > span').innerHTML = '<svg width="27" height="27" viewBox="0 0 28 28" aria-hidden="true"><path d="M8 21L20 9V4" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="8" cy="21" r="5" fill="currentColor"/></svg>';
const cells = Array.from({ length: 81 }, (_, i) => {
  const b = document.createElement('button'); b.className = 'cell'; b.dataset.cell = String(i);
  b.style.gridArea = `${Math.floor(i / 9) + 1} / ${i % 9 + 1}`;
  if (i % 9 === 2 || i % 9 === 5) b.classList.add('box-right');
  if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) b.classList.add('box-bottom');
  $('#cells').append(b); return b;
});
function save() { try { localStorage.setItem('thermo-studio-v1', JSON.stringify(puzzle)); } catch { /* Storage is optional. */ } }
function cancel() { worker?.terminate(); worker = null; busy = false; }
function message(title: string, body: string) { status = title; detail = body; }
function commit(change: () => void) {
  cancel(); hintMasks = null; past.push(JSON.stringify(puzzle)); if (past.length > 100) past.shift(); future = []; change();
  message('Board updated.', 'Check your puzzle to test whether it has exactly one solution.'); save(); render();
}
function render() {
  const bad = conflicts(puzzle), state = candidates(puzzle);
  cells.forEach((b, i) => {
    const v = puzzle.values[i];
    b.classList.toggle('selected', i === selected); b.classList.toggle('given', !!puzzle.givens[i]); b.classList.toggle('conflict', bad.has(i));
    b.classList.toggle('same-digit', !!v && v === puzzle.values[selected] && i !== selected);
    b.tabIndex = i === selected ? 0 : -1;
    b.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}${v ? `, ${v}${puzzle.givens[i] ? ', given' : ''}` : ', empty'}${bad.has(i) ? ', conflict' : ''}`);
    b.setAttribute('aria-pressed', String(i === selected));
    b.innerHTML = v ? `<span class="digit">${v}</span>` : showCandidates && state.valid ? `<span class="pencil">${Array.from({ length: 9 }, (_, n) => `<span>${digitsOf(hintMasks?.[i] ?? state.grid.cands[i]).includes(n + 1) ? n + 1 : ''}</span>`).join('')}</span>` : '';
  });
  const point = (c: number) => `${(c % 9) * 100 + 50},${Math.floor(c / 9) * 100 + 50}`;
  $('#thermos').innerHTML = [...puzzle.thermos, ...(draft.length ? [draft] : [])].map((t, i) => `<g class="${i === puzzle.thermos.length ? 'draft' : ''}"><polyline points="${t.map(point).join(' ')}"/><circle cx="${t[0] % 9 * 100 + 50}" cy="${Math.floor(t[0] / 9) * 100 + 50}" r="34"/></g>`).join('');
  $('#filled').textContent = `${puzzle.values.filter(Boolean).length} / 81 filled · ${puzzle.thermos.length} thermometers`;
  $('#status-title').textContent = busy ? 'Following the logic…' : bad.size ? 'These digits conflict.' : status;
  $('#status-detail').textContent = busy ? 'Checking Sudoku and every thermometer together.' : bad.size ? 'Red cells break Sudoku or the selected thermometer rule.' : detail;
  $('#status').classList.toggle('error', bad.size > 0);
  $('#thermo-variant').classList.toggle('active', puzzle.variant === 'thermo');
  $('#slow-variant').classList.toggle('active', puzzle.variant === 'slow');
  $('#thermo-variant').setAttribute('aria-pressed', String(puzzle.variant === 'thermo'));
  $('#slow-variant').setAttribute('aria-pressed', String(puzzle.variant === 'slow'));
  $<HTMLInputElement>('#no-thermo-givens').checked = puzzle.noThermoGivens;
  $('#variant-rules').textContent = puzzle.variant === 'slow'
    ? 'Normal sudoku rules apply. Starting at the bulb, digits along each Slow Thermo must increase or stay the same. At least one thermometer must have an equal consecutive pair in the completed grid.'
    : 'Normal sudoku rules apply. Starting at the bulb, digits along each thermometer must strictly increase.';
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => { b.classList.toggle('active', b.dataset.tool === tool); b.setAttribute('aria-pressed', String(b.dataset.tool === tool)); });
  $('#tool-help').textContent = tool === 'thermo' ? 'Click the bulb, then adjacent cells. Or drag a path. Diagonal turns are welcome. Press Enter to finish; Esc to cancel.' : tool === 'erase' ? 'Click a cell on a thermometer to remove it. At overlaps, the most recently drawn path is removed first.' : 'Select a cell and add a given with the number pad or your keyboard.';
  $('#finish').hidden = !draft.length;
  $('#candidates').setAttribute('aria-label', 'Show candidates');
  $('#undo').toggleAttribute('disabled', !past.length); $('#redo').toggleAttribute('disabled', !future.length);
  for (const id of ['check', 'hint', 'solve', 'generate']) $<HTMLButtonElement>(`#${id}`).disabled = busy || draft.length > 0;
  $('#cancel').hidden = !busy;
}
function enterDigit(d: number) {
  if (tool !== 'digit') return;
  if (puzzle.values[selected] === d && puzzle.givens[selected] === d) return;
  commit(() => { puzzle.values[selected] = d; puzzle.givens[selected] = d; });
}
function extend(c: number) {
  if (draft.at(-1) === c) return;
  if (draft.length > 1 && draft.at(-2) === c) { draft.pop(); render(); return; }
  if (!draft.length || (draft.length < (puzzle.variant === 'slow' ? 81 : 9) && !draft.includes(c) && adjacent(draft.at(-1)!, c))) { draft.push(c); render(); }
  else { message('Keep the path connected.', 'Use a distinct neighboring cell. Strict Thermo allows nine cells; Slow Thermo allows up to 81.'); render(); }
}
function finish() {
  if (draft.length < 2) { draft = []; message('Thermometer canceled.', 'A thermometer needs at least two cells.'); render(); return; }
  const t = [...draft]; draft = [];
  if (puzzle.thermos.some(x => JSON.stringify(x) === JSON.stringify(t))) { message('That thermometer already exists.', 'Draw another path or edit a given.'); render(); return; }
  if (puzzle.thermos.length >= 100) { message('Thermometer limit reached.', 'Remove a thermometer before adding another.'); render(); return; }
  commit(() => puzzle.thermos.push(t));
}
function selectCell(c: number) {
  selected = c;
  if (tool === 'thermo') extend(c);
  else if (tool === 'erase') {
    const index = puzzle.thermos.findLastIndex(t => t.includes(c));
    if (index >= 0) commit(() => puzzle.thermos.splice(index, 1));
  }
  render();
}
$('#cells').addEventListener('pointerdown', e => {
  const c = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]'); if (!c || e.button !== 0) return;
  if (tool === 'thermo') { e.preventDefault(); dragging = true; dragExtended = false; }
  selectCell(Number(c.dataset.cell));
});
window.addEventListener('pointermove', e => {
  if (!dragging || tool !== 'thermo') return;
  const c = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]');
  if (c && Number(c.dataset.cell) !== draft.at(-1)) { const before = draft.join(); extend(Number(c.dataset.cell)); if (before !== draft.join()) dragExtended = true; }
});
window.addEventListener('pointerup', () => { if (dragging && dragExtended) finish(); dragging = false; });
window.addEventListener('pointercancel', () => { dragging = false; draft = []; render(); });
$('#cells').addEventListener('click', e => { if (e.detail === 0) { const c = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]'); if (c) selectCell(Number(c.dataset.cell)); } });
document.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(b => b.onclick = () => enterDigit(Number(b.dataset.digit)));
document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.onclick = () => { tool = b.dataset.tool as typeof tool; draft = []; render(); });
$('#finish').onclick = finish;
function changeVariant(variant: Puzzle['variant']) {
  if (variant === puzzle.variant) return;
  if (variant === 'thermo' && puzzle.thermos.some(t => t.length > 9)) {
    message('Shorten the long thermometers first.', 'Strict Thermo supports at most nine cells per path.'); render(); return;
  }
  draft = []; commit(() => { puzzle.variant = variant; puzzle.values = [...puzzle.givens]; });
}
$('#thermo-variant').onclick = () => changeVariant('thermo');
$('#slow-variant').onclick = () => changeVariant('slow');
$<HTMLInputElement>('#no-thermo-givens').onchange = e => {
  const checked = (e.target as HTMLInputElement).checked;
  commit(() => { puzzle.noThermoGivens = checked; });
};
$<HTMLInputElement>('#candidates').onchange = e => { showCandidates = (e.target as HTMLInputElement).checked; render(); };
function undo(redo = false) {
  const from = redo ? future : past, to = redo ? past : future;
  const next = from.pop(); if (!next) return; cancel(); hintMasks = null; to.push(JSON.stringify(puzzle)); puzzle = JSON.parse(next); draft = []; message(redo ? 'Change restored.' : 'Change undone.', 'Your puzzle is saved on this device.'); save(); render();
}
$('#undo').onclick = () => undo(); $('#redo').onclick = () => undo(true);
window.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || ['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); enterDigit(Number(e.key)); }
  if (['Backspace', 'Delete', '0'].includes(e.key)) { e.preventDefault(); enterDigit(0); }
  const moves: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (e.key in moves) { e.preventDefault(); selected = (selected + moves[e.key] + 81) % 81; render(); cells[selected].focus(); }
  if (e.key === 'Enter' && draft.length) { e.preventDefault(); finish(); }
  if (e.key === 'Escape') { draft = []; render(); }
});
function run(type: 'check' | 'hint' | 'solve' | 'generate') {
  if (busy || draft.length) return;
  busy = true; render(); worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  worker.onerror = () => { cancel(); message('Solver could not start.', 'Please reload the page and try again.'); render(); };
  worker.onmessage = event => {
    cancel();
    if (event.data.error) { message('Check this position.', event.data.error); render(); return; }
    if (type === 'generate') {
      commit(() => { puzzle = validatePuzzle(event.data.result); tool = 'digit'; });
      message('A new puzzle, with one solution.', puzzle.variant === 'slow' ? 'The unique completed grid includes at least one repeated step on a Slow Thermo.' : 'Every thermometer strictly increases in the unique completed grid.');
    } else if (type === 'hint') {
      const h = event.data.result as Hint | null;
      if (h) {
        if (h.values.some((v, i) => v !== puzzle.values[i])) commit(() => { puzzle.values = h.values; tool = 'digit'; });
        hintMasks = h.candidates;
        showCandidates = true; $<HTMLInputElement>('#candidates').checked = true;
        message(h.technique, h.description);
      } else message('No logical step found.', 'The imported techniques found no next step. Try Solve puzzle to search, or check your entries.');
    } else {
      const r = event.data.result as SolveResult;
      const title = r.solutions.length >= 2 ? 'More than one solution.' : !r.exhausted ? 'Search limit reached.' : r.solutions.length ? 'Exactly one solution.' : 'No solution exists.';
      const body = r.solutions.length >= 2 ? 'Add givens or thermometers to narrow down your puzzle.' : !r.exhausted ? 'The five-second search budget ended. Uniqueness is not established; add constraints and try again.' : r.solutions.length ? 'Every row, column, box, and thermometer checks out.' : 'These constraints cannot all be satisfied. Review the givens and thermometer directions.';
      if (type === 'solve' && r.solutions.length) commit(() => { puzzle.values = r.solutions[0]; tool = 'digit'; });
      message(title, body + (type === 'solve' && r.solutions.length ? ' A solution is now on the board. Undo to return to your entries.' : ''));
    }
    render();
  };
  // Check the author's clues; solving and hints use the current playing position.
  worker.postMessage({ type, puzzle: type === 'check' ? { ...puzzle, values: [...puzzle.givens] } : puzzle });
}
$('#generate').onclick = () => {
  $('#confirm-title').textContent = 'Generate a new puzzle?'; $<HTMLDialogElement>('#confirm').showModal();
  $('#confirm-yes').onclick = () => { $<HTMLDialogElement>('#confirm').close(); run('generate'); };
};
$('#check').onclick = () => run('check'); $('#hint').onclick = () => run('hint'); $('#solve').onclick = () => run('solve');
$('#cancel').onclick = () => { cancel(); message('Search canceled.', 'Your puzzle is unchanged.'); render(); };
function confirmChange(title: string, action: () => void) {
  $('#confirm-title').textContent = title; $<HTMLDialogElement>('#confirm').showModal();
  $('#confirm-yes').onclick = () => { $<HTMLDialogElement>('#confirm').close(); draft = []; commit(action); };
}
$('#confirm-no').onclick = () => $<HTMLDialogElement>('#confirm').close();
$('#new').onclick = () => confirmChange('Start a new puzzle?', () => { puzzle = blank(puzzle.variant, puzzle.noThermoGivens); tool = 'digit'; });
$('#example').onclick = () => confirmChange('Load the example puzzle?', () => { puzzle = example(); tool = 'digit'; });
$('#reset').onclick = () => confirmChange('Reset your solving entries?', () => { puzzle.values = [...puzzle.givens]; });
function transfer(exporting: boolean) {
  $('#transfer-title').textContent = exporting ? 'Take your puzzle with you.' : 'Import a puzzle.';
  $('#transfer-help').textContent = exporting ? 'Givens, entries, and thermometer paths are all included.' : 'Paste a Thermo Sudoku JSON puzzle below. Import replaces the board and can be undone.';
  $<HTMLTextAreaElement>('#puzzle-json').value = exporting ? JSON.stringify(puzzle, null, 2) : '';
  $<HTMLTextAreaElement>('#puzzle-json').readOnly = exporting;
  $('#load-json').hidden = exporting; $('#download').hidden = !exporting; $('#import-error').textContent = '';
  $<HTMLDialogElement>('#transfer').showModal();
}
$('#import').onclick = () => transfer(false); $('#export').onclick = () => transfer(true);
$('#load-json').onclick = () => {
  try {
    const p = validatePuzzle(JSON.parse($<HTMLTextAreaElement>('#puzzle-json').value));
    draft = []; commit(() => { puzzle = p; tool = 'digit'; }); $<HTMLDialogElement>('#transfer').close();
  } catch (e) { $('#import-error').textContent = e instanceof Error ? e.message : 'Invalid puzzle JSON.'; }
};
$('#download').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(puzzle, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'thermo-sudoku.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
render();
