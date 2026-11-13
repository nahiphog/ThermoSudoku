import { generationControls } from './generation-controls';
import { blank, generationError, type Puzzle } from './puzzle';
import { board } from './grid-markup';
import { openSimulationStore, type SimulationMatch } from './simulation-store';

export function mountSimulationPage() {
  const page = document.createElement('main'); page.id = 'simulation-page'; page.hidden = true;
  page.innerHTML = `<section class="card settings-card" aria-label="Simulation options">
    ${generationControls('Simulation', 'sim-')}
    <div class="generation-options simulation-selects">
      <label>Total trials <select id="sim-trials">${[1, 10, 100, 1000, 10000, 1000000].map(n => `<option value="${n}" ${n === 1000000 ? 'selected' : ''}>${n.toLocaleString('en-US')}</option>`).join('')}</select></label>
      <label>Display grids with difficulty of at least <select id="sim-threshold">${[0, 500, 1000, 2000, 3000, 5000, 10000, 10000000].map(n => `<option value="${n}" ${n === 1000 ? 'selected' : ''}>${n.toLocaleString('en-US')}</option>`).join('')}</select></label>
    </div>
    <p class="muted">Each trial generates and rates one complete puzzle. Only grids meeting the minimum rating are displayed. The simulation continues while you browse other pages; keep this tab open. Starting again replaces this run’s results.</p>
    <p id="sim-generation-error" role="alert"></p>
    <div class="button-pair"><button id="sim-start" class="primary">Start simulation</button><button id="sim-stop" class="outline" hidden>Stop simulation</button></div>
    <p id="sim-status" role="status" aria-live="polite"></p>
    <p id="sim-stats"></p><progress id="sim-progress" value="0" max="1000000" aria-label="Completed trials" hidden></progress>
  </section>
  <section aria-label="Qualifying grids"><h2>Qualifying grids</h2><p id="sim-empty">Start a simulation to see qualifying grids.</p><div id="sim-results" class="simulation-grids"></div>
    <div id="sim-pagination" class="button-pair" hidden><button id="sim-prev" class="outline">Previous grids</button><span id="sim-page-number"></span><button id="sim-next" class="outline">Next grids</button></div>
  </section>`;
  document.querySelector('#techniques-page')!.after(page);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => page.querySelector<T>(`#sim-${id}`)!;
  const puzzle = blank();
  let worker: Worker | null = null, running = false, generation = 0, renderVersion = 0;
  let completed = 0, matches = 0, total = 1000000, threshold = 1000, highest = 0, pageIndex = 0;
  let store: Awaited<ReturnType<typeof openSimulationStore>> | null = null;
  const pageSize = 12;
  function readOptions(): string | null {
    const text = $<HTMLInputElement>('thermo-lengths').value;
    if (text.trim() && !/^\s*\d+\s*(,\s*\d+\s*)*$/.test(text)) return 'Enter whole-number lengths separated by commas, for example 4,4,4,5.';
    puzzle.thermoLengths = text.trim() ? text.split(',').map(Number) : undefined;
    puzzle.noGivens = $<HTMLInputElement>('no-givens').checked;
    puzzle.logicalOnly = $<HTMLInputElement>('logical-only').checked;
    puzzle.symmetricThermos = $<HTMLInputElement>('symmetric-thermos').checked;
    return generationError(puzzle.variant, puzzle);
  }
  function controls() {
    for (const el of page.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.settings-card input, .settings-card select, .mode-switch button')) el.disabled = running;
    const error = readOptions(); $('generation-error').textContent = error ?? '';
    $<HTMLButtonElement>('start').disabled = running || !!error; $('stop').hidden = !running;
    for (const variant of ['thermo', 'slow'] as const) {
      const button = $(`${variant}-variant`); button.classList.toggle('active', puzzle.variant === variant);
      button.setAttribute('aria-pressed', String(puzzle.variant === variant));
    }
  }
  function stats() {
    $('stats').textContent = `${completed.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} trials completed · ${matches.toLocaleString('en-US')} qualifying grids · Highest rating: ${highest}`;
    $<HTMLProgressElement>('progress').max = total; $<HTMLProgressElement>('progress').value = completed;
    $('empty').hidden = matches > 0;
    $('empty').textContent = 'No completed grids meet the selected minimum rating yet.';
    $('pagination').hidden = matches <= pageSize;
    $<HTMLButtonElement>('prev').disabled = pageIndex === 0;
    $<HTMLButtonElement>('next').disabled = (pageIndex + 1) * pageSize >= matches;
    $('page-number').textContent = `Page ${pageIndex + 1} of ${Math.max(1, Math.ceil(matches / pageSize))}`;
  }
  async function showPage() {
    const version = ++renderVersion;
    const rows = await store!.page(pageIndex * pageSize, pageSize);
    if (version !== renderVersion) return;
    $('results').innerHTML = rows.map(row => `<article class="card"><h3>Trial ${row.trial.toLocaleString('en-US')}</h3><p>Difficulty rating: ${row.score}</p><div class="board" aria-label="Trial ${row.trial} puzzle">${board(row.puzzle, row.puzzle.givens)}</div></article>`).join('');
    stats();
  }
  function stop(message: string) {
    generation++; worker?.terminate(); worker = null; running = false;
    $('status').textContent = message; controls();
  }
  $('start').onclick = async () => {
    if (running || readOptions()) return;
    running = true; const token = ++generation; ++renderVersion; controls();
    $('status').textContent = 'Preparing simulation…';
    try {
      store ??= await openSimulationStore();
      if (token !== generation) return;
      await store.clear();
      if (token !== generation) return;
      completed = matches = highest = pageIndex = 0;
      total = Number($<HTMLSelectElement>('trials').value); threshold = Number($<HTMLSelectElement>('threshold').value);
      $('results').replaceChildren(); $('progress').hidden = false; stats();
      const options: Puzzle = structuredClone(puzzle);
      const current = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' }); worker = current;
      const next = () => {
        $('status').textContent = `Running trial ${(completed + 1).toLocaleString('en-US')} of ${total.toLocaleString('en-US')}…`;
        current.postMessage({ puzzle: options, threshold });
      };
      current.onerror = () => { if (token === generation) stop('Simulation stopped because a trial failed. Completed results are retained.'); };
      current.onmessage = async (event: MessageEvent<{ error?: string; score: number; match: Omit<SimulationMatch, 'trial'> | null }>) => {
        if (token !== generation) return;
        if (event.data.error) { stop(`Simulation stopped: ${event.data.error} Completed results are retained.`); return; }
        try {
          const match = event.data.match;
          if (match) await store!.add({ ...match, trial: completed + 1 });
          if (token !== generation) return;
          completed++; highest = Math.max(highest, event.data.score);
          if (match) matches++;
          stats();
          if (match && matches > pageIndex * pageSize && matches <= (pageIndex + 1) * pageSize) await showPage();
          if (token !== generation) return;
          if (completed === total) stop('Simulation complete.'); else next();
        } catch { if (token === generation) stop('Simulation stopped: browser storage could not save or load a grid. Completed results are retained.'); }
      };
      next();
    } catch { if (token === generation) stop('Could not start the simulation. Browser storage and Web Workers must be available.'); }
  };
  $('stop').onclick = () => stop('Simulation stopped. Completed results are retained; the unfinished trial is not counted.');
  for (const [id, delta] of [['prev', -1], ['next', 1]] as const) $(id).onclick = async () => {
    pageIndex = Math.max(0, Math.min(Math.ceil(matches / pageSize) - 1, pageIndex + delta));
    stats();
    try { await showPage(); } catch { $('status').textContent = 'Could not load these saved grids.'; }
  };
  for (const variant of ['thermo', 'slow'] as const) $(`${variant}-variant`).onclick = () => { puzzle.variant = variant; controls(); };
  for (const id of ['no-givens', 'logical-only', 'symmetric-thermos'] as const) $<HTMLInputElement>(id).checked = !!puzzle[id === 'no-givens' ? 'noGivens' : id === 'logical-only' ? 'logicalOnly' : 'symmetricThermos'];
  page.querySelectorAll('input, select').forEach(el => el.addEventListener('input', controls));
  controls();
}
