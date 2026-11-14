import { adjacent, blank, validatePuzzle, type Variant } from './puzzle';
import { thermometerMarkup, bulbHighlight, unitArrows } from './grid-markup';
import { renderTechniqueTallies } from './technique-tallies';
import type { Analysis } from './walkthrough';
import { encodePuzzle } from './puzzle-string';
import { gridImage } from './grid-image';
import { cellContents } from './cell-contents';
import type { CustomBuildResult } from './custom-builder';

export function mountCustomBuildPage() {
  const link = document.createElement('a');
  link.href = '?page=custom-build'; link.textContent = 'Custom Build';
  document.querySelector('.page-nav')!.append(link);
  const root = document.createElement('main');
  root.id = 'custom-build-page'; root.hidden = true;
  root.innerHTML = `
    <section class="card settings-card">
      <div class="settings-heading"><h1>Custom Build</h1><div class="mode-switch" aria-label="Custom puzzle type">
        <button data-variant="thermo">Thermo</button><button data-variant="slow">Slow Thermo</button><button data-variant="missing">Missing Thermometer</button>
      </div></div>
      <p id="custom-rules" class="muted"></p>
      <p>Click or tap a starting cell, then neighboring cells (including diagonals) to draw a thermometer. Choose Finish thermo before starting another. Overlapping paths are allowed.</p>
      <div class="custom-toolbar"><button id="custom-finish" class="primary">Finish thermo</button><button id="custom-back" class="outline">Undo last cell</button><button id="custom-cancel" class="outline">Cancel path</button></div>
      <p class="muted">Finish your paths, then Build a puzzle with one solution using this exact layout. Clues may appear on thermometers when needed.</p>
      <button id="custom-build" class="primary">Build</button>
      <p id="custom-status" role="status" aria-live="polite"></p>
    </section>
    <div class="workspace"><section class="board-panel" aria-label="Custom puzzle workspace">
      <dl id="custom-rating" class="stats" hidden aria-label="Puzzle difficulty"><div><dt>Difficulty rating</dt><dd id="custom-score"></dd></div><div><dt>Difficulty level</dt><dd id="custom-level"></dd></div><div><dt>Hardest technique used</dt><dd id="custom-hardest"></dd></div></dl>
      <div id="custom-board" class="board" role="group" aria-label="Custom Sudoku grid"><svg class="thermo-overlay" viewBox="0 0 900 900" aria-hidden="true"></svg><div class="cells"></div></div>
      <section id="custom-walk-panel" hidden aria-label="Solution walkthrough">
        <div class="walk-heading"><h2>Solution walkthrough</h2><button id="custom-walk-close" class="text-button">Return to puzzle</button></div>
        <p id="custom-step-count" class="muted"></p><h3 id="custom-step-title"></h3><p id="custom-step-description" class="muted" aria-live="polite"></p>
        <input id="custom-step-range" type="range" min="0" value="0" aria-label="Custom solution step">
        <div class="button-pair"><button id="custom-step-prev" class="outline">Previous step</button><button id="custom-step-next" class="primary">Next step</button></div>
        <div class="button-pair"><button id="custom-step-first" class="text-button">Starting puzzle</button><button id="custom-step-last" class="text-button">Completed grid</button></div>
        <p class="muted">Purple: a placed digit. Red crossed marks: eliminated candidates. Blue: pattern; amber: support; purple: fins; green: restored candidates. Teal: relevant cells. Green bulb: found end; dashed red: ruled-out end. Trials and restored positions are included.</p>
        <div id="custom-tallies"></div>
      </section>
      <button id="custom-walk-open" class="outline full" hidden>View solution walkthrough</button>
      <p id="custom-count" class="muted"></p>
      <button id="custom-reveal" class="outline full" hidden>Reveal solution</button>
      <button id="custom-copy-image" class="outline full">Copy grid as an image</button>
      <div class="custom-toolbar"><button id="custom-undo" class="outline">Undo change</button><button id="custom-clear" class="outline">Clear thermos</button></div>
      <div id="custom-paths" class="custom-paths" aria-label="Placed thermometers"></div>
      <button id="custom-export" class="primary full">Copy puzzle string</button>
      <label id="custom-export-label" hidden>Puzzle string — copy and paste into Import grid to check this puzzle<textarea id="custom-string" readonly></textarea></label>
    </section></div>`;
  document.querySelector('#maker-page')!.after(root);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(id)!;
  let puzzle = blank(), draft: number[] = [], selected = 0;
  let worker: Worker | null = null, solution: number[] | null = null, revealed = false;
  let analysis: Analysis | null = null, slide: number | null = null;
  const history: typeof puzzle[] = [];
  try { const saved = localStorage.getItem('thermo-custom-build-v1'); if (saved) puzzle = validatePuzzle(JSON.parse(saved)); } catch { /* Optional storage. */ }
  const status = (text: string) => { get('#custom-status').textContent = text; };
  const save = () => { try { localStorage.setItem('thermo-custom-build-v1', JSON.stringify(puzzle)); } catch { /* Optional storage. */ } };
  const remember = () => { history.push(structuredClone(puzzle)); if (history.length > 100) history.shift(); get('#custom-export-label').hidden = true; solution = null; revealed = false; analysis = null; slide = null; puzzle.givens = Array(81).fill(0); puzzle.values = Array(81).fill(0); };
  const cells = Array.from({ length: 81 }, (_, i) => {
    const cell = document.createElement('button'); cell.className = 'cell'; cell.dataset.cell = String(i);
    cell.classList.toggle('box-right', i % 9 === 2 || i % 9 === 5);
    cell.classList.toggle('box-bottom', Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5);
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}`);
    cell.onclick = () => {
      if (worker) return;
      selected = i;
      if (slide !== null) { render(); return; }
      if (!draft.length && puzzle.thermos.length >= 100) { status('Remove a thermometer before adding another (maximum 100).'); return; }
      if (draft.includes(i)) { status('Each cell can appear only once in a path. Use Undo last cell to shorten it.'); return; }
      if (draft.length && !adjacent(draft.at(-1)!, i)) { status('Choose a cell next to the current tip, including diagonally.'); return; }
      if (draft.length >= (puzzle.variant === 'slow' ? 81 : 9)) { status('This thermometer has reached its maximum length. Finish it to start another.'); return; }
      draft.push(i); status(`${draft.length} cells in this path. ${draft.length < 2 ? 'Add a neighboring cell.' : 'Continue drawing or choose Finish thermo.'}`); render();
    };
    cell.onkeydown = event => {
      const moves: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
      if (event.key in moves) { event.preventDefault(); selected = (i + moves[event.key] + 81) % 81; render(); cells[selected].focus(); }
      if (event.key === 'Escape') { draft = []; status('Path canceled.'); render(); }
    };
    get('#custom-board .cells').append(cell); return cell;
  });
  function render() {
    const frame = slide !== null ? analysis?.frames[slide] : null;
    const values = frame?.values ?? (revealed && solution ? solution : puzzle.givens);
    const related = new Set([...(frame?.relatedCells ?? []), ...(frame?.strictInequalities?.flat() ?? [])]);
    root.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach(button => {
      const active = button.dataset.variant === puzzle.variant;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); button.disabled = !!worker;
    });
    get('#custom-rules').textContent = puzzle.variant === 'slow' ? 'Slow Thermo: digits never decrease, with at least one equal consecutive pair in the solution. Paths can contain 2–81 cells.' : puzzle.variant === 'missing' ? 'Missing Thermometer: bulbs are hidden; either end can be the bulb. Paths can contain 2–9 cells.' : 'Thermo: digits strictly increase from the first cell (the bulb). Paths can contain 2–9 cells.';
    get('#custom-board svg').innerHTML = thermometerMarkup(puzzle, values, frame?.bulbEnds) + (draft.length ? `<g class="custom-draft">${thermometerMarkup({ ...puzzle, thermos: [draft] }, puzzle.givens)}</g>` : '');
    get('#custom-board .unit-arrows')?.remove();
    get('#custom-board').insertAdjacentHTML('beforeend', unitArrows(frame));
    cells.forEach((cell, i) => {
      cell.tabIndex = selected === i ? 0 : -1;
      cell.classList.toggle('selected', selected === i);
      cell.classList.toggle('custom-draft-cell', draft.includes(i));
      cell.innerHTML = cellContents(values[i], i, frame);
      for (const name of ['bulb-found', 'bulb-rejected', 'bulb-path']) cell.classList.toggle(name, bulbHighlight(frame, i) === name);
      cell.classList.toggle('step-reason', related.has(i));
      cell.classList.toggle('step-placement', !!frame?.placements.some(p => p.cell === i));
      cell.classList.toggle('step-elimination', !!frame?.eliminations.some(p => p.cell === i));
      cell.classList.toggle('given', !!puzzle.givens[i]);
      cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}, ${values[i] || 'empty'}`);
      cell.disabled = !!worker;
    });
    get<HTMLButtonElement>('#custom-finish').disabled = draft.length < 2 || !!worker;
    for (const id of ['#custom-back', '#custom-cancel']) get<HTMLButtonElement>(id).disabled = !draft.length;
    get<HTMLButtonElement>('#custom-undo').disabled = !history.length || !!draft.length || !!worker;
    get<HTMLButtonElement>('#custom-clear').disabled = !puzzle.thermos.length || !!draft.length || !!worker;
    get<HTMLButtonElement>('#custom-export').disabled = !!draft.length || !!worker;
    get<HTMLButtonElement>('#custom-copy-image').disabled = !!draft.length || !!worker || slide !== null;
    get<HTMLButtonElement>('#custom-build').disabled = !worker && (!puzzle.thermos.length || !!draft.length);
    get('#custom-build').textContent = worker ? 'Cancel build' : 'Build';
    get('#custom-reveal').hidden = !solution;
    get<HTMLButtonElement>('#custom-reveal').disabled = !!worker || !!draft.length;
    get('#custom-reveal').textContent = revealed ? 'Hide solution' : 'Reveal solution';
    get('#custom-reveal').setAttribute('aria-pressed', String(revealed));
    get('#custom-rating').hidden = !analysis;
    get('#custom-walk-panel').hidden = !frame;
    get('#custom-walk-open').hidden = !analysis || slide !== null;
    get<HTMLButtonElement>('#custom-walk-open').disabled = !!worker || !!draft.length;
    if (analysis) {
      get('#custom-score').textContent = String(analysis.score);
      get('#custom-level').textContent = analysis.level;
      get('#custom-hardest').textContent = analysis.hardest;
      if (frame && slide !== null) {
        get('#custom-step-count').textContent = `Step ${slide + 1} of ${analysis.frames.length}`;
        get('#custom-step-title').textContent = frame.title;
        get('#custom-step-description').textContent = frame.description;
        const range = get<HTMLInputElement>('#custom-step-range'); range.max = String(analysis.frames.length - 1); range.value = String(slide);
        range.setAttribute('aria-valuetext', `Step ${slide + 1}: ${frame.title}`);
        get<HTMLButtonElement>('#custom-step-prev').disabled = slide === 0;
        get<HTMLButtonElement>('#custom-step-next').disabled = slide === analysis.frames.length - 1;
        renderTechniqueTallies(get('#custom-tallies'), analysis, index => { slide = index; render(); get('#custom-step-title').tabIndex = -1; get('#custom-step-title').focus({ preventScroll: true }); get('#custom-board').scrollIntoView({ block: 'start' }); });
      }
    }
    get('#custom-count').textContent = `${puzzle.thermos.length} thermometers placed · Drafts save automatically after finishing a path.`;
    const paths = get('#custom-paths'); paths.replaceChildren();
    puzzle.thermos.forEach((path, index) => {
      const row = document.createElement('div');
      const label = document.createElement('span'); label.textContent = `Thermo ${index + 1} · ${path.length} cells · r${Math.floor(path[0] / 9) + 1}c${path[0] % 9 + 1}`;
      const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = 'Delete'; remove.setAttribute('aria-label', `Delete thermo ${index + 1}`); remove.disabled = !!draft.length || !!worker;
      remove.onclick = () => { remember(); puzzle.thermos.splice(index, 1); save(); status('Thermometer deleted. Undo change restores it.'); render(); };
      row.append(label, remove); paths.append(row);
    });
  }
  root.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach(button => button.onclick = () => {
    const variant = button.dataset.variant as Variant;
    if (variant === puzzle.variant) return;
    if (variant !== 'slow' && [...puzzle.thermos, draft].some(path => path.length > 9)) { status('Shorten or delete paths longer than 9 cells before switching to this puzzle type.'); return; }
    remember(); puzzle.variant = variant; save(); status('Puzzle type updated. Your paths have been kept.'); render();
  });
  get('#custom-finish').onclick = () => { if (draft.length < 2) return; remember(); puzzle.thermos.push([...draft]); draft = []; save(); status('Thermometer placed. Choose a starting cell for the next one.'); render(); };
  get('#custom-back').onclick = () => { draft.pop(); status('Last cell removed.'); render(); };
  get('#custom-cancel').onclick = () => { draft = []; status('Path canceled.'); render(); };
  get('#custom-undo').onclick = () => { const previous = history.pop(); if (previous) { puzzle = previous; solution = null; revealed = false; analysis = null; slide = null; save(); get('#custom-export-label').hidden = true; status('Change undone.'); render(); } };
  get('#custom-clear').onclick = () => { remember(); puzzle.thermos = []; save(); status('Thermometers cleared. Undo change restores them.'); render(); };
  get('#custom-reveal').onclick = () => { slide = null; revealed = !revealed; render(); };
  get('#custom-walk-open').onclick = () => { slide = 0; revealed = false; render(); };
  get('#custom-walk-close').onclick = () => { slide = null; revealed = false; render(); };
  get('#custom-step-prev').onclick = () => { if (slide !== null) slide = Math.max(0, slide - 1); render(); };
  get('#custom-step-next').onclick = () => { if (slide !== null && analysis) slide = Math.min(analysis.frames.length - 1, slide + 1); render(); };
  get('#custom-step-first').onclick = () => { slide = 0; render(); };
  get('#custom-step-last').onclick = () => { if (analysis) slide = analysis.frames.length - 1; render(); };
  get('#custom-step-range').oninput = event => { slide = Number((event.target as HTMLInputElement).value); render(); };
  get('#custom-build').onclick = () => {
    if (worker) { worker.terminate(); worker = null; status('Build canceled. Your puzzle is unchanged.'); render(); return; }
    if (draft.length || !puzzle.thermos.length) return;
    const active = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    worker = active; status('Building a puzzle from your thermometers…'); render();
    active.onerror = () => { if (worker !== active) return; active.terminate(); worker = null; status('Could not build the puzzle. Try again.'); render(); };
    active.onmessage = event => {
      if (worker !== active) return;
      if (event.data.buildProgress) { status(event.data.buildProgress); return; }
      active.terminate(); worker = null;
      if (event.data.error) { status(event.data.error); render(); return; }
      const result = event.data.result as CustomBuildResult;
      remember(); puzzle = result.puzzle; solution = result.solution; analysis = result.analysis; slide = 0; save();
      status(`Puzzle built with ${puzzle.givens.filter(Boolean).length} clues and exactly one solution. Your thermometer layout is unchanged.`); render();
    };
    active.postMessage({ type: 'custom-build', puzzle });
  };
  get('#custom-copy-image').onclick = async () => {
    if (draft.length || worker || slide !== null) return;
    const png = gridImage(puzzle, [...(revealed && solution ? solution : puzzle.givens)]);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Clipboard images unavailable');
      // Start the clipboard write within the click's activation, including Safari.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      status('Grid image copied. It matches the currently visible grid.');
    } catch {
      try {
        const url = URL.createObjectURL(await png), link = document.createElement('a');
        link.href = url; link.download = 'thermo-sudoku.png'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status('Grid image downloaded. Clipboard access was unavailable; the same PNG was saved instead.');
      } catch { status('Could not create the grid image. Please try again in a browser with canvas support.'); }
    }
  };
  get('#custom-export').onclick = async () => {
    const text = encodePuzzle(puzzle);
    get<HTMLTextAreaElement>('#custom-string').value = text; get('#custom-export-label').hidden = false;
    try { await navigator.clipboard.writeText(text); status('Puzzle string copied. Paste it into Import grid to check the puzzle.'); }
    catch { get<HTMLTextAreaElement>('#custom-string').select(); status('Select and copy the puzzle string below.'); }
  };
  status('Choose a puzzle type and start placing thermometers.'); render();
}
