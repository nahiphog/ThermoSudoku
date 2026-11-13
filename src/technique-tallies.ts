import { TECHS } from './techniques';
import type { Analysis } from './walkthrough';

const scores = new Map(Object.values(TECHS).map(info => [info.name.toLowerCase(), info.score]));
scores.set('thermometer bounds', 5);
export const techniqueScore = (name: string) => scores.get(name.toLowerCase()) ?? Infinity;

const rendered = new WeakMap<HTMLElement, { analysis: Analysis; navigate: (index: number) => void }>();

/** Counts cover the complete recorded solve, including unsuccessful trial branches. */
export function renderTechniqueTallies(container: HTMLElement, analysis: Analysis, navigate: (index: number) => void) {
  const previous = rendered.get(container);
  if (previous?.analysis === analysis) { previous.navigate = navigate; return; }
  const state = { analysis, navigate }; rendered.set(container, state);
  const steps = new Map<string, number[]>();
  analysis.frames.forEach((frame, index) => {
    if (!['logic', 'thermo', 'guess'].includes(frame.kind)) return;
    const indices = steps.get(frame.title) ?? [];
    indices.push(index); steps.set(frame.title, indices);
  });
  const table = document.createElement('table'); table.className = 'technique-tallies';
  table.innerHTML = '<caption>Technique tallies</caption><thead><tr><th scope="col">Technique</th><th scope="col">Uses and steps</th></tr></thead><tbody></tbody>';
  const body = table.querySelector('tbody')!;
  for (const [name, count] of Object.entries(analysis.techniques).sort(([a], [b]) => techniqueScore(a) - techniqueScore(b) || a.localeCompare(b))) {
    const row = body.insertRow(); const heading = document.createElement('th');
    heading.scope = 'row'; heading.textContent = name; row.append(heading);
    const cell = row.insertCell();
    const uses = document.createElement('span'); uses.className = 'technique-uses';
    uses.textContent = `${count} ${count === 1 ? 'use' : 'uses'}`; cell.append(uses);
    const links = document.createElement('span'); links.className = 'technique-steps';
    links.append('Steps: ');
    for (const [position, index] of (steps.get(name) ?? []).entries()) {
      if (position) links.append(', ');
      const button = document.createElement('button'); button.type = 'button'; button.className = 'technique-step';
      button.textContent = String(index + 1);
      button.setAttribute('aria-label', `Go to step ${index + 1}: ${name}`);
      button.onclick = () => state.navigate(index);
      links.append(button);
    }
    cell.append(links);
  }
  const note = document.createElement('p'); note.className = 'tally-note';
  note.textContent = Object.keys(analysis.techniques).length
    ? `Totals for the entire walkthrough, including failed trial branches. Each use counts once, regardless of how many candidates it removes. Backtracking rollbacks: ${analysis.backtracks}.`
    : 'No solving techniques were needed: the imported grid was already complete.';
  container.replaceChildren(table, note);
}
