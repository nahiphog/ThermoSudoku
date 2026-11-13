import { TECHS, type Tech } from './vendor/sudokui/ratings';
const supported: Tech[] = [
  'FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE', 'LOCKED_CANDIDATES_1', 'LOCKED_CANDIDATES_2',
  'NAKED_PAIR', 'NAKED_TRIPLE', 'NAKED_QUADRUPLE', 'HIDDEN_PAIR', 'HIDDEN_TRIPLE', 'HIDDEN_QUADRUPLE',
  'X_WING', 'SWORDFISH', 'JELLYFISH', 'XY_WING', 'XYZ_WING', 'W_WING', 'SKYSCRAPER', 'TWO_STRING_KITE', 'EMPTY_RECTANGLE',
  'FINNED_X_WING', 'SASHIMI_X_WING', 'FINNED_SWORDFISH', 'SASHIMI_SWORDFISH', 'FINNED_JELLYFISH', 'SASHIMI_JELLYFISH', 'BRUTE_FORCE',
];
export const repertoire = [...supported.map(key => ({ ...TECHS[key], name: key === 'BRUTE_FORCE' ? 'Brute force' : TECHS[key].name })),
  { name: 'Thermometer bounds', score: 5, level: 'Easy', category: 'Thermometers' },
].sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
export function mountTechniquesPage() {
  const page = document.createElement('main'); page.id = 'techniques-page'; page.hidden = true;
  page.innerHTML = `<section class="card"><h1>Techniques</h1><p>The solving repertoire, ordered by ascending difficulty rating. Ratings are points per use; equal ratings are ordered alphabetically. Brute force is a trial, not a logical deduction.</p><div class="techniques-scroll"><table class="technique-catalog"><thead><tr><th scope="col">Technique</th><th scope="col">Rating</th><th scope="col">Level</th><th scope="col">Category</th></tr></thead><tbody>${repertoire.map(info => `<tr><th scope="row">${info.name}</th><td>${info.score}</td><td>${info.level}</td><td>${info.category}</td></tr>`).join('')}</tbody></table></div></section>`;
  document.querySelector('#import-page')!.after(page);
}
