export function generationControls(title: string, prefix = '') {
  return `    <div class="settings-heading"><h1>${title}</h1><div class="mode-switch" aria-label="Thermometer variant"><button id="${prefix}thermo-variant">Thermo</button><button id="${prefix}slow-variant">Slow Thermo</button></div></div>
    <div class="generation-options">
      <div class="exact-lengths"><label for="${prefix}thermo-lengths">Exact thermometer lengths (optional)</label><input id="${prefix}thermo-lengths" type="text" placeholder="4,4,4,5" aria-describedby="${prefix}lengths-help ${prefix}generation-error"><p id="${prefix}lengths-help" class="muted">Comma-separated cell counts, including each bulb. Enter one length per thermometer, or leave blank for automatic lengths.</p></div>
      <label><input id="${prefix}no-givens" type="checkbox"> No given cells</label>
      <label><input id="${prefix}logical-only" type="checkbox"> Logical techniques only (no Brute force)</label>
      <label><input id="${prefix}symmetric-thermos" type="checkbox"> Rotationally symmetric thermometers</label>
    </div>
`;
}
