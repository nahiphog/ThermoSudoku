import { adjacent, blank, validatePuzzle, type Variant } from './puzzle';
import { thermometerMarkup } from './grid-markup';
import { encodePuzzle } from './puzzle-string';

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
      <p id="custom-status" role="status" aria-live="polite"></p>
    </section>
    <div class="workspace"><section class="board-panel" aria-label="Custom puzzle workspace">
      <div id="custom-board" class="board" role="group" aria-label="Custom Sudoku grid"><svg class="thermo-overlay" viewBox="0 0 900 900" aria-hidden="true"></svg><div class="cells"></div></div>
      <p id="custom-count" class="muted"></p>
      <div class="custom-toolbar"><button id="custom-undo" class="outline">Undo change</button><button id="custom-clear" class="outline">Clear thermos</button></div>
      <div id="custom-paths" class="custom-paths" aria-label="Placed thermometers"></div>
      <button id="custom-export" class="primary full">Copy puzzle string</button>
      <label id="custom-export-label" hidden>Puzzle string — copy and paste into Import grid to check this puzzle<textarea id="custom-string" readonly></textarea></label>
    </section></div>`;
  document.querySelector('#maker-page')!.after(root);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(id)!;
  let puzzle = blank(), draft: number[] = [], selected = 0;
  const history: typeof puzzle[] = [];
  try { const saved = localStorage.getItem('thermo-custom-build-v1'); if (saved) puzzle = validatePuzzle(JSON.parse(saved)); } catch { /* Optional storage. */ }
  const status = (text: string) => { get('#custom-status').textContent = text; };
  const save = () => { try { localStorage.setItem('thermo-custom-build-v1', JSON.stringify(puzzle)); } catch { /* Optional storage. */ } };
  const remember = () => { history.push(structuredClone(puzzle)); if (history.length > 100) history.shift(); get('#custom-export-label').hidden = true; };
  const cells = Array.from({ length: 81 }, (_, i) => {
    const cell = document.createElement('button'); cell.className = 'cell'; cell.dataset.cell = String(i);
    cell.classList.toggle('box-right', i % 9 === 2 || i % 9 === 5);
    cell.classList.toggle('box-bottom', Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5);
    cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}`);
    cell.onclick = () => {
      selected = i;
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
    root.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach(button => {
      const active = button.dataset.variant === puzzle.variant;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    get('#custom-rules').textContent = puzzle.variant === 'slow' ? 'Slow Thermo: digits never decrease, with at least one equal consecutive pair in the solution. Paths can contain 2–81 cells.' : puzzle.variant === 'missing' ? 'Missing Thermometer: bulbs are hidden; either end can be the bulb. Paths can contain 2–9 cells.' : 'Thermo: digits strictly increase from the first cell (the bulb). Paths can contain 2–9 cells.';
    get('#custom-board svg').innerHTML = thermometerMarkup(puzzle, puzzle.givens) + (draft.length ? `<g class="custom-draft">${thermometerMarkup({ ...puzzle, thermos: [draft] }, puzzle.givens)}</g>` : '');
    cells.forEach((cell, i) => {
      cell.tabIndex = selected === i ? 0 : -1;
      cell.classList.toggle('selected', selected === i);
      cell.classList.toggle('custom-draft-cell', draft.includes(i));
    });
    get<HTMLButtonElement>('#custom-finish').disabled = draft.length < 2;
    for (const id of ['#custom-back', '#custom-cancel']) get<HTMLButtonElement>(id).disabled = !draft.length;
    get<HTMLButtonElement>('#custom-undo').disabled = !history.length || !!draft.length;
    get<HTMLButtonElement>('#custom-clear').disabled = !puzzle.thermos.length || !!draft.length;
    get<HTMLButtonElement>('#custom-export').disabled = !!draft.length;
    get('#custom-count').textContent = `${puzzle.thermos.length} thermometers placed · Drafts save automatically after finishing a path.`;
    const paths = get('#custom-paths'); paths.replaceChildren();
    puzzle.thermos.forEach((path, index) => {
      const row = document.createElement('div');
      const label = document.createElement('span'); label.textContent = `Thermo ${index + 1} · ${path.length} cells · r${Math.floor(path[0] / 9) + 1}c${path[0] % 9 + 1}`;
      const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = 'Delete'; remove.setAttribute('aria-label', `Delete thermo ${index + 1}`); remove.disabled = !!draft.length;
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
  get('#custom-undo').onclick = () => { const previous = history.pop(); if (previous) { puzzle = previous; save(); get('#custom-export-label').hidden = true; status('Change undone.'); render(); } };
  get('#custom-clear').onclick = () => { remember(); puzzle.thermos = []; save(); status('Thermometers cleared. Undo change restores them.'); render(); };
  get('#custom-export').onclick = async () => {
    const text = encodePuzzle(puzzle);
    get<HTMLTextAreaElement>('#custom-string').value = text; get('#custom-export-label').hidden = false;
    try { await navigator.clipboard.writeText(text); status('Puzzle string copied. Paste it into Import grid to check the puzzle.'); }
    catch { get<HTMLTextAreaElement>('#custom-string').select(); status('Select and copy the puzzle string below.'); }
  };
  status('Choose a puzzle type and start placing thermometers.'); render();
}
