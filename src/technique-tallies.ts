import { TECHS } from './vendor/sudokui/ratings';
import type { Analysis } from './walkthrough';

const scores = new Map(Object.values(TECHS).map(info => [info.name.toLowerCase(), info.score]));
scores.set('thermometer bounds', 5);
export const techniqueScore = (name: string) => scores.get(name.toLowerCase()) ?? Infinity;

/** Counts cover the complete recorded solve, including unsuccessful trial branches. */
export function renderTechniqueTallies(container: HTMLElement, analysis: Analysis) {
  const table = document.createElement('table'); table.className = 'technique-tallies';
  table.innerHTML = '<caption>Technique tallies</caption><thead><tr><th scope="col">Technique</th><th scope="col">Times used</th></tr></thead><tbody></tbody>';
  const body = table.querySelector('tbody')!;
  for (const [name, count] of Object.entries(analysis.techniques).sort(([a], [b]) => techniqueScore(a) - techniqueScore(b) || a.localeCompare(b))) {
    const row = body.insertRow(); const heading = document.createElement('th');
    heading.scope = 'row'; heading.textContent = name; row.append(heading);
    row.insertCell().textContent = String(count);
  }
  const note = document.createElement('p'); note.className = 'tally-note';
  note.textContent = Object.keys(analysis.techniques).length
    ? `Totals for the entire walkthrough, including failed trial branches. Each use counts once, regardless of how many candidates it removes. Backtracking rollbacks: ${analysis.backtracks}.`
    : 'No solving techniques were needed: the imported grid was already complete.';
  container.replaceChildren(table, note);
}
