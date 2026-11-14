import { encodePuzzle } from './puzzle-string';
import { gridImage } from './grid-image';
import { renderTechniqueTallies } from './technique-tallies';
import { parseImport, type ImportResult } from './import-check';
import type { Puzzle } from './puzzle';
import { board } from './grid-markup';


export function mountImportPage() {
  const page = document.createElement('main'); page.id = 'import-page'; page.hidden = true;
  page.innerHTML = `<section class="card"><h1>Import grid</h1><p>Paste a copied puzzle string, including one inside a message, or puzzle JSON. You can also paste 81 Sudoku digits (0 or . for blanks); digits alone contain no thermometers.</p><label for="import-text">Puzzle string</label><textarea id="import-text" spellcheck="false"></textarea><div class="button-pair"><button id="inspect-import" class="primary">Check uniqueness</button><button id="stop-import" class="outline" hidden>Cancel check</button></div><p id="import-status" role="status" aria-live="polite"></p></section><div id="import-results"></div>`;
  document.querySelector('#maker-page')!.after(page);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => page.querySelector<T>(id)!;
  let worker: Worker | null = null;
  const stop = () => { worker?.terminate(); worker = null; $<HTMLButtonElement>('#inspect-import').disabled = false; $('#stop-import').hidden = true; };
  const clear = () => { stop(); $('#import-results').innerHTML = ''; $('#import-status').textContent = ''; };
  window.addEventListener('pagechange', () => {
    if (page.hidden && worker) { stop(); $('#import-status').textContent = 'Check canceled.'; }
  });
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
      target.innerHTML = `<div class="import-columns"><section class="card"><h2 id="import-grid-title">Completed grid</h2><div id="import-completed" class="board" aria-label="Completed grid">${board(p, result.solutions[0])}</div><div class="import-grid-actions"><button id="import-reveal" class="primary" aria-pressed="true">Hide solution</button><button id="import-copy-string" class="outline">Copy grid as a string</button><button id="import-copy-image" class="outline">Copy grid as an image</button></div><p id="import-copy-status" role="status" aria-live="polite"></p><label id="import-copy-label" for="import-copy-fallback" hidden>Grid string — select and copy</label><textarea id="import-copy-fallback" readonly hidden></textarea></section><section class="card"><h2>Solution walkthrough</h2><div id="import-walk-content"></div></section></div>`;
      let revealed = true;
      const visibleValues = () => revealed ? result.solutions[0] : p.givens;
      $('#import-reveal').onclick = () => {
        revealed = !revealed;
        const title = revealed ? 'Completed grid' : 'Given grid';
        $('#import-grid-title').textContent = title;
        $('#import-completed').setAttribute('aria-label', title);
        $('#import-completed').innerHTML = board(p, visibleValues());
        $('#import-reveal').textContent = revealed ? 'Hide solution' : 'Reveal solution';
        $('#import-reveal').setAttribute('aria-pressed', String(revealed));
        $('#import-copy-status').textContent = '';
        $('#import-copy-label').hidden = $('#import-copy-fallback').hidden = true;
      };
      $('#import-copy-string').onclick = async () => {
        const text = encodePuzzle({ ...p, givens: [...visibleValues()] });
        const label = revealed ? 'Completed' : 'Given';
        try {
          await navigator.clipboard.writeText(text);
          $('#import-copy-status').textContent = `${label} grid string copied.`;
        } catch {
          $('#import-copy-label').hidden = $('#import-copy-fallback').hidden = false;
          $<HTMLTextAreaElement>('#import-copy-fallback').value = text;
          $<HTMLTextAreaElement>('#import-copy-fallback').select();
          $('#import-copy-status').textContent = 'Clipboard unavailable. Select and copy the grid string below.';
        }
      };
      $('#import-copy-image').onclick = async () => {
        const png = gridImage(p, [...visibleValues()]);
        const label = revealed ? 'Completed' : 'Given';
        try {
          if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Clipboard unavailable');
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
          $('#import-copy-status').textContent = `${label} grid image copied.`;
        } catch {
          try {
            const url = URL.createObjectURL(await png), link = document.createElement('a');
            link.href = url; link.download = `thermo-${label.toLowerCase()}-grid.png`; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            $('#import-copy-status').textContent = 'Clipboard unavailable. Grid image downloaded.';
          } catch { $('#import-copy-status').textContent = 'Could not create the grid image. Please try again.'; }
        }
      };
      if (!result.analysis) { $('#import-walk-content').textContent = `The solution is verified, but the walkthrough could not finish. ${result.analysisError ?? ''} Check again to retry.`; return; }
      const analysis = result.analysis; let index = 0;
      $('#import-walk-content').innerHTML = `<p id="import-rating"></p><div id="import-tallies"></div><div id="import-walk-board" class="board" aria-label="Walkthrough grid"></div><p id="import-step-count"></p><h3 id="import-step-title"></h3><p id="import-step-description" aria-live="polite"></p><input id="import-step-range" type="range" min="0" max="${analysis.frames.length - 1}" value="0" aria-label="Imported solution step"><div class="button-pair"><button id="import-prev" class="outline">Previous step</button><button id="import-next" class="primary">Next step</button></div><div class="button-pair"><button id="import-first" class="text-button">Starting puzzle</button><button id="import-last" class="text-button">Completed step</button></div><p class="muted">Purple: placed digit. Red crossed marks: eliminated candidates. Candidate highlights: blue pattern, amber support, purple fins, green restored; red crossed candidates are eliminated. Outside arrows: involved rows and columns. Teal outlines: involved boxes. Cell and candidate marks: specific evidence. Green bulb: found end; dashed red: ruled-out end. Trials and rollbacks are labeled.</p>`;
      $('#import-rating').textContent = `Difficulty rating: ${analysis.score} (estimated). Hardest technique: ${analysis.hardest}.`;
      const renderStep = () => {
        const frame = analysis.frames[index]; $('#import-walk-board').innerHTML = board(p, frame.values, [], frame);
        $('#import-step-count').textContent = `Step ${index + 1} of ${analysis.frames.length}`;
        $('#import-step-title').textContent = frame.title; $('#import-step-description').textContent = frame.description;
        $<HTMLInputElement>('#import-step-range').value = String(index);
        $<HTMLButtonElement>('#import-prev').disabled = index === 0; $<HTMLButtonElement>('#import-next').disabled = index === analysis.frames.length - 1;
      };
      renderTechniqueTallies($('#import-tallies'), analysis, step => {
        index = step; renderStep();
        $('#import-step-title').tabIndex = -1; $('#import-step-title').focus({ preventScroll: true });
        $('#import-walk-board').scrollIntoView({ block: 'start' });
      });
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
