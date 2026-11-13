import { generationControls } from './generation-controls';
import { mountSimulationPage } from './simulation-page';
import { mountNavigation } from './navigation';
import { mountTechniquesPage } from './techniques-page';
import './style.css';
import { renderTechniqueTallies } from './technique-tallies';
import { mountImportPage } from './import-page';
import { encodePuzzle, decodePuzzle } from './puzzle-string';
import { blank, example, validatePuzzle, generationError, type Puzzle } from './puzzle';
import { conflicts, type SolveResult } from './solver';
import { gridImage } from './grid-image';
import type { GeneratedPuzzle, GenerationProgress } from './generator';
import { digitsOf } from './vendor/sudokui/board';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
let puzzle = example(), solution: number[] | null = null, revealed = false, selected = 0;
let worker: Worker | null = null, busy: 'generate' | 'check' | 'solve' | null = null;
let generationStarted: number | null = null, generationElapsed: number | null = null;
let generationTimer: ReturnType<typeof setInterval> | null = null;
let status = '', detail = '';
let report: GeneratedPuzzle | null = null, slide: number | null = null, progress: GenerationProgress | null = null;
try {
  const saved = localStorage.getItem('thermo-studio-v1');
  if (saved) puzzle = validatePuzzle(JSON.parse(saved));
  puzzle.values = [...puzzle.givens];
} catch { /* Storage is optional. */ }

let lengthsText = puzzle.thermoLengths?.join(',') ?? '';
let lengthsError: string | null = null;

$('#app').innerHTML = `
<header class="topbar"><details id="page-menu"><summary>Generate</summary><nav class="page-nav" aria-label="Pages"><a href="?page=generate">Generate</a><a href="?page=import-grid">Import grid</a><a href="?page=simulation">Simulation</a><a href="?page=techniques">Techniques</a></nav></details><a class="brand" href="./" aria-label="Thermo home"><img class="brand-icon" src="${import.meta.env.BASE_URL}thermometer.svg" width="32" height="32" alt=""> thermo<span class="brand-dot">.</span></a><div class="header-actions"><button id="about" class="outline" aria-haspopup="dialog" aria-controls="about-dialog">About</button></div></header>

<main id="maker-page">
  <section class="card settings-card" aria-label="Puzzle options">
    ${generationControls('Generate')}
    <div class="generate-row"><button id="generate" class="primary">Generate puzzle</button><span id="generation-elapsed" class="muted" hidden></span></div>
    <p id="generation-error" role="alert"></p>
    <div id="status" role="status" aria-live="polite"><strong id="status-title"></strong><p id="status-detail"></p></div>
  </section>
  <div class="workspace">
    <section class="board-panel" aria-label="Sudoku workspace">
      <dl id="generation-stats" class="stats" hidden aria-label="Generation statistics"><div><dt>Givens</dt><dd id="stat-givens"></dd></div><div><dt>Thermometers</dt><dd id="stat-thermos"></dd></div><div><dt>Thermometer cells</dt><dd id="stat-occupied"></dd></div><div><dt>Generation time</dt><dd id="stat-time"></dd></div><div><dt>Difficulty rating</dt><dd id="stat-score"></dd></div><div><dt>Hardest technique used</dt><dd id="stat-hardest"></dd></div></dl>
      <div id="board" class="board" role="group" aria-label="Thermo Sudoku grid"><svg id="thermos" class="thermo-overlay" viewBox="0 0 900 900" aria-hidden="true"></svg><div id="cells" class="cells"></div></div>
      <section id="walkthrough-panel" hidden aria-label="Solution walkthrough"><div class="walk-explanation">
        <div class="walk-heading"><h2>Solution walkthrough</h2><button id="close-walkthrough" class="text-button" aria-label="Close walkthrough">Return to puzzle</button></div>
        <p id="slide-count" class="muted"></p><h3 id="slide-title"></h3><p id="slide-description" class="muted" aria-live="polite"></p>
        <input id="slide-range" type="range" min="0" value="0" aria-label="Solution step">
        <div class="button-pair"><button id="slide-prev" class="outline">Previous step</button><button id="slide-next" class="primary">Next step</button></div>
        <div class="button-pair"><button id="slide-first" class="text-button">Starting puzzle</button><button id="slide-last" class="text-button">Completed grid</button></div>
        <p class="muted">Purple: a placed digit. Red crossed marks: eliminated candidates. Trials and restored positions are explicitly labeled.</p></div><div id="technique-tallies"></div>
      </section>
      <div class="board-footer"><span id="filled"></span><span>Manual entry disabled</span></div>
      <div id="grid-actions" class="button-pair"><button id="copy-image" class="outline">Copy grid as an image</button><button id="reveal" class="primary">Reveal solution</button></div>
      <button id="copy-string" class="outline full">Copy puzzle string</button>
    </section>
    <aside>
      <section id="generation-report" class="card" hidden aria-label="Generation statistics">
        <h2>Your generated puzzle</h2>

        <p id="dig-summary" class="muted"></p>
        <h3 id="difficulty"></h3><p id="rating-summary" class="muted"></p>
        <details><summary>How this estimate is calculated</summary><p class="muted">We sum the imported sudokUI technique scores, add 5 per thermometer-bound reduction and 10,000 per Brute force use. The level uses the hardest technique and the imported score thresholds; any trial is Extreme. This is an engine-based estimate, not a calibrated human difficulty or an official HoDoKu rating.</p><p id="technique-summary" class="muted"></p></details>
        <button id="walkthrough" class="outline full">View solution walkthrough</button>
      </section>

    </aside>
  </div>
  <section class="bottom-actions"><div><button id="new" class="text-button">＋ New puzzle</button><button id="example" class="text-button">Load example</button></div><div><button id="import" class="text-button">↓ Import</button><button id="export" class="text-button">↑ Export</button></div></section>
</main>
<dialog id="about-dialog" aria-labelledby="about-title">
  <form method="dialog"><div class="dialog-heading"><h2 id="about-title">About the puzzles</h2><button aria-label="Close About" class="text-button" autofocus>✕</button></div></form>
  <p>Both puzzles follow normal Sudoku rules: fill every row, column, and 3 × 3 box with the digits 1–9, without repeats. Read each thermometer from its round bulb toward its tip.</p>
  <section aria-labelledby="about-thermo"><h3 id="about-thermo">Thermo Sudoku</h3><p>Digits must strictly increase along each thermometer. Every digit must be larger than the one before it; for example, 1 → 3 → 6 → 9.</p></section>
  <section aria-labelledby="about-slow"><h3 id="about-slow">Slow Thermo Sudoku</h3><p>Digits may increase or stay the same along each thermometer, but must never decrease; for example, 1 → 3 → 3 → 6. Equal digits are allowed only when they do not share a row, column, or 3 × 3 box.</p><p>In this app, the completed grid must include at least one equal consecutive pair somewhere on a thermometer.</p></section>
</dialog>
<dialog id="transfer"><form method="dialog"><div class="dialog-heading"><h2 id="transfer-title">Import puzzle</h2><button aria-label="Close dialog" class="text-button">✕</button></div></form><p id="transfer-help"></p><textarea id="puzzle-json" spellcheck="false" aria-label="Puzzle JSON"></textarea><p id="import-error" role="alert"></p><button id="load-json" class="primary full">Import puzzle</button><button id="download" class="primary full" hidden>Download JSON</button></dialog>
<dialog id="confirm"><h2 id="confirm-title"></h2><p>This replaces the current puzzle.</p><div class="button-pair"><button id="confirm-no" class="outline">Keep puzzle</button><button id="confirm-yes" class="primary">Continue</button></div></dialog>`;

$('#about').onclick = () => $<HTMLDialogElement>('#about-dialog').showModal();

const cells = Array.from({ length: 81 }, (_, i) => {
  const b = document.createElement('button'); b.className = 'cell'; b.dataset.cell = String(i);
  if (i % 9 === 2 || i % 9 === 5) b.classList.add('box-right');
  if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) b.classList.add('box-bottom');
  b.onclick = () => { selected = i; render(); };
  $('#cells').append(b); return b;
});
const settings = {
  'symmetric-thermos': 'symmetricThermos',
  'logical-only': 'logicalOnly',
  'no-givens': 'noGivens',
} as const;
function save() { try { localStorage.setItem('thermo-studio-v1', JSON.stringify(puzzle)); } catch { /* Storage is optional. */ } }
function updateElapsed() {
  if (generationStarted !== null) generationElapsed = performance.now() - generationStarted;
  $('#generation-elapsed').hidden = generationElapsed === null;
  $('#generation-elapsed').textContent = generationElapsed === null ? '' : 'Elapsed: ' + (generationElapsed / 1000).toFixed(1) + ' s';
}
function cancel() {
  worker?.terminate(); worker = null; busy = null; progress = null;
  updateElapsed(); generationStarted = null;
  if (generationTimer !== null) clearInterval(generationTimer);
  generationTimer = null;
}
function message(title: string, body: string) { status = title; detail = body; }
function replace(next: Puzzle) {
  cancel(); puzzle = next; lengthsText = puzzle.thermoLengths?.join(',') ?? ''; lengthsError = null; puzzle.values = [...puzzle.givens]; solution = null; revealed = false; report = null; slide = null; save(); render();
}
const visibleValues = () => slide !== null && report ? report.analysis.frames[slide].values : revealed && solution ? solution : puzzle.givens;
function render() {
  const values = visibleValues(), bad = conflicts({ ...puzzle, values });
  const frame = slide !== null ? report?.analysis.frames[slide] : null;
  cells.forEach((b, i) => {
    b.classList.toggle('selected', i === selected); b.classList.toggle('given', !!puzzle.givens[i]); b.classList.toggle('conflict', bad.has(i));
    b.tabIndex = i === selected ? 0 : -1;
    b.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}${puzzle.givens[i] ? ', given' : ''}`);
    b.setAttribute('aria-pressed', String(i === selected));
    b.classList.toggle('step-placement', !!frame?.placements.some(p => p.cell === i));
    b.classList.toggle('step-elimination', !!frame?.eliminations.some(p => p.cell === i));
    const removed = frame?.eliminations.filter(p => p.cell === i).map(p => p.digit) ?? [];
    const remaining = frame ? digitsOf(frame.candidates[i]) : [];
    b.innerHTML = values[i] ? `<span class="digit">${values[i]}</span>` : frame ? `<span class="pencil">${Array.from({ length: 9 }, (_, d) => `<span class="${removed.includes(d + 1) ? 'removed-candidate' : ''}">${removed.includes(d + 1) || remaining.includes(d + 1) ? d + 1 : ''}</span>`).join('')}</span>` : '';
  });
  const point = (c: number) => `${c % 9 * 100 + 50},${Math.floor(c / 9) * 100 + 50}`;
  $('#thermos').innerHTML = puzzle.thermos.map(t => `<g><polyline points="${t.map(point).join(' ')}"/><circle cx="${t[0] % 9 * 100 + 50}" cy="${Math.floor(t[0] / 9) * 100 + 50}" r="34"/></g>`).join('');
  $('#filled').textContent = `${values.filter(Boolean).length} / 81 filled · ${puzzle.thermos.length} thermometers`;
  $('#status').hidden = !busy && !progress && !status && !detail;
  $('#status-title').textContent = progress ? `Step ${progress.stage} of 6 · Attempt ${progress.attempt}` : busy === 'generate' ? 'Generating your puzzle…' : busy ? 'Checking every constraint…' : status;
  $('#status-detail').textContent = progress?.text ?? (busy ? 'Looking for exactly one solution with your selected rules.' : detail);
  for (const [id, key] of Object.entries(settings)) { $<HTMLInputElement>(`#${id}`).checked = !!puzzle[key]; $<HTMLInputElement>(`#${id}`).disabled = !!busy; }
  for (const v of ['thermo', 'slow'] as const) {
    const b = $<HTMLButtonElement>(`#${v}-variant`); b.classList.toggle('active', puzzle.variant === v); b.setAttribute('aria-pressed', String(puzzle.variant === v)); b.disabled = !!busy;
  }
  for (const id of ['reveal', 'copy-image']) $<HTMLButtonElement>(`#${id}`).disabled = !!busy;
  $('#grid-actions').hidden = !puzzle.givens.some(Boolean) && !puzzle.thermos.length;
  $('#reveal').textContent = revealed ? 'Hide solution' : 'Reveal solution';
  $('#reveal').setAttribute('aria-pressed', String(revealed));
  $<HTMLButtonElement>('#copy-image').disabled = !!busy || slide !== null;
  $('#generation-report').hidden = !report;
  $('#generation-stats').hidden = !report;
  const invalid = lengthsError ?? generationError(puzzle.variant, puzzle);
  $('#generation-error').textContent = invalid ?? '';
  const lengthsInput = $<HTMLInputElement>('#thermo-lengths');
  if (lengthsInput.value !== lengthsText) lengthsInput.value = lengthsText;
  lengthsInput.disabled = !!busy; lengthsInput.setAttribute('aria-invalid', String(!!invalid && !!lengthsText));
  $<HTMLButtonElement>('#generate').disabled = !busy && !!invalid;
  $('#generate').textContent = busy ? 'Cancel' : 'Generate puzzle';
  updateElapsed();
  $('#walkthrough-panel').hidden = slide === null || !report;
  if (report) {
    const { stats: s, analysis: a } = report;
    $('#stat-givens').textContent = String(s.givens); $('#stat-thermos').textContent = String(s.thermometers);
    $('#stat-occupied').textContent = String(s.thermoCells); $('#stat-time').textContent = `${(s.elapsedMs / 1000).toFixed(2)} s`;
    $('#stat-score').textContent = String(a.score); $('#stat-hardest').textContent = a.hardest;
    $('#dig-summary').textContent = report.puzzle.noGivens ? 'No given cells. The thermometers alone determine the unique solution.' : `${s.attempts} layout attempt(s). Tested ${s.pairsTested} clue orbits and removed ${s.pairsRemoved}. No remaining rotational pair can be removed while keeping a unique solution.`;
    $('#difficulty').textContent = `${a.level} · ${a.score} points (estimated)`;
    $('#rating-summary').textContent = `Hardest step: ${a.hardest}. ${a.guesses} Brute force use(s), ${a.backtracks} rollback(s).`;
    $('#technique-summary').textContent = Object.entries(a.techniques).map(([name, count]) => `${name}: ${count}`).join(' · ');
    $<HTMLButtonElement>('#walkthrough').disabled = !!busy;
    if (frame && slide !== null) {
      renderTechniqueTallies($('#technique-tallies'), a, index => {
        slide = index; render();
        $('#slide-title').tabIndex = -1; $('#slide-title').focus({ preventScroll: true });
        $('#board').scrollIntoView({ block: 'start' });
      });

      $('#slide-count').textContent = `Step ${slide + 1} of ${a.frames.length}`; $('#slide-title').textContent = frame.title;
      $('#slide-description').textContent = frame.description;
      const range = $<HTMLInputElement>('#slide-range'); range.max = String(a.frames.length - 1); range.value = String(slide);
      range.setAttribute('aria-valuetext', `Step ${slide + 1}: ${frame.title}`);
      $<HTMLButtonElement>('#slide-prev').disabled = slide === 0; $<HTMLButtonElement>('#slide-next').disabled = slide === a.frames.length - 1;
    }
  }
}
$('#thermo-lengths').oninput = e => {
  lengthsText = (e.target as HTMLInputElement).value;
  lengthsError = lengthsText.trim() && !/^\s*\d+\s*(,\s*\d+\s*)*$/.test(lengthsText) ? 'Enter whole-number lengths separated by commas, for example 4,4,4,5.' : null;
  if (!lengthsError) {
    puzzle.thermoLengths = lengthsText.trim() ? lengthsText.split(',').map(Number) : undefined;
    if (!generationError(puzzle.variant, puzzle)) save();
  }
  render();
};
for (const [id, key] of Object.entries(settings)) $<HTMLInputElement>(`#${id}`).onchange = e => {
  puzzle[key] = (e.target as HTMLInputElement).checked; save(); message('Generation options updated.', 'These settings apply when you generate your next puzzle.'); render();
};
for (const v of ['thermo', 'slow'] as const) $(`#${v}-variant`).onclick = () => {
  if (puzzle.variant === v) return;
  if (v === 'thermo' && puzzle.thermos.some(t => t.length > 9)) { message('This path is too long for strict Thermo.', 'Start a new puzzle before switching variants.'); render(); return; }
  puzzle.variant = v; solution = null; revealed = false; report = null; slide = null; save(); message('Variant updated.', 'Generate a puzzle with the selected rules.'); render();
};
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).closest('#page-menu') || $('#maker-page').hidden || document.querySelector('dialog[open]') || ['TEXTAREA', 'INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key) || ['Backspace', 'Delete'].includes(e.key)) { e.preventDefault(); return; }
  const moves: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (e.key in moves) { e.preventDefault(); selected = (selected + moves[e.key] + 81) % 81; render(); cells[selected].focus(); }
});
function run(type: 'check' | 'solve' | 'generate') {
  if (busy || (type === 'generate' && (lengthsError || generationError(puzzle.variant, puzzle)))) return;
  busy = type;
  if (type === 'generate') { generationStarted = performance.now(); generationElapsed = 0; generationTimer = setInterval(updateElapsed, 100); }
  render(); worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  const activeWorker = worker;
  worker.onerror = () => { if (worker !== activeWorker) return; cancel(); message('Could not complete the request.', 'Please try again.'); render(); };
  worker.onmessage = event => {
    if (worker !== activeWorker) return;
    if (event.data.progress) { progress = event.data.progress; render(); return; }
    cancel();
    if (event.data.error) { message('Could not complete the request.', event.data.error); render(); return; }
    if (type === 'generate') {
      const generated = event.data.result as GeneratedPuzzle;
      generated.stats.elapsedMs = generationElapsed ?? generated.stats.elapsedMs;
      replace(validatePuzzle(generated.puzzle)); report = generated; solution = generated.solution;
      message('A new puzzle, with one solution.', 'All six stages are complete. View the statistics and solution walkthrough.');
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
$('#generate').onclick = () => {
  if (busy) { cancel(); message('Canceled.', 'Your current puzzle is unchanged.'); render(); }
  else run('generate');
};
$('#reveal').onclick = () => {
  slide = null;
  if (revealed) { revealed = false; render(); }
  else if (solution) { revealed = true; render(); }
  else run('solve');
};
$('#walkthrough').onclick = () => { if (report) { slide = 0; revealed = false; render(); $('#board').scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
$('#close-walkthrough').onclick = () => { slide = null; render(); };
$('#slide-prev').onclick = () => { if (slide !== null && slide > 0) { slide--; render(); } };
$('#slide-next').onclick = () => { if (report && slide !== null && slide < report.analysis.frames.length - 1) { slide++; render(); } };
$('#slide-first').onclick = () => { slide = 0; render(); };
$('#slide-last').onclick = () => { if (report) { slide = report.analysis.frames.length - 1; render(); } };
$<HTMLInputElement>('#slide-range').oninput = e => { slide = Number((e.target as HTMLInputElement).value); render(); };
$('#new').onclick = () => confirmChange('Start a new puzzle?', () => {
  const next = blank(puzzle.variant, puzzle.noThermoGivens);
  for (const key of Object.values(settings)) next[key] = !!puzzle[key];
  next.thermometerCount = puzzle.thermometerCount; next.minThermoLength = puzzle.minThermoLength;
  replace(next); message('', ''); render();
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
$('#copy-string').onclick = async () => {
  const text = encodePuzzle(puzzle);
  try { await navigator.clipboard.writeText(text); message('Puzzle string copied.', 'Paste it into Import to restore the givens, variant and ordered thermometer paths. Solutions are never included.'); }
  catch { transfer(true); $('#transfer-help').textContent = 'Clipboard access was unavailable. Select and copy this puzzle string.'; $<HTMLTextAreaElement>('#puzzle-json').value = text; $('#download').hidden = true; $<HTMLTextAreaElement>('#puzzle-json').select(); }
  render();
};
function transfer(exporting: boolean) {
  $('#transfer-title').textContent = exporting ? 'Export puzzle' : 'Import puzzle';
  $('#transfer-help').textContent = exporting ? 'Includes givens, thermometer paths, and generation preferences. Revealing the solution never changes the exported puzzle.' : 'Paste a TS1 puzzle string or a Thermo Sudoku JSON puzzle. Import replaces the current puzzle.';
  $<HTMLTextAreaElement>('#puzzle-json').value = exporting ? JSON.stringify(puzzle, null, 2) : '';
  $<HTMLTextAreaElement>('#puzzle-json').readOnly = exporting;
  $('#load-json').hidden = exporting; $('#download').hidden = !exporting; $('#import-error').textContent = '';
  $<HTMLDialogElement>('#transfer').showModal();
}
$('#import').onclick = () => transfer(false); $('#export').onclick = () => transfer(true);
$('#load-json').onclick = () => {
  try { replace($<HTMLTextAreaElement>('#puzzle-json').value.trim().startsWith('TS1|') ? decodePuzzle($<HTMLTextAreaElement>('#puzzle-json').value) : validatePuzzle(JSON.parse($<HTMLTextAreaElement>('#puzzle-json').value))); $<HTMLDialogElement>('#transfer').close(); message('Puzzle imported.', 'Check the puzzle or reveal its solution.'); render(); }
  catch (e) { $('#import-error').textContent = e instanceof Error ? e.message : 'Invalid puzzle JSON.'; }
};
$('#download').onclick = () => download(new Blob([JSON.stringify(puzzle, null, 2)], { type: 'application/json' }), 'thermo-sudoku.json');
render();

mountImportPage();

mountTechniquesPage();
mountSimulationPage();
mountNavigation();
