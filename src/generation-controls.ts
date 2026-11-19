export function generationControls(title: string, prefix = '') {
  return `    <div class="settings-heading"><h1>${title}</h1><div class="mode-switch" aria-label="Thermometer variant"><button id="${prefix}thermo-variant">Thermo</button><button id="${prefix}slow-variant">Slow Thermo</button><button id="${prefix}missing-variant">Missing Thermometer</button></div></div>
    <div class="generation-options">
      <div class="exact-lengths"><label for="${prefix}thermo-lengths">Exact thermometer lengths (optional)</label><input id="${prefix}thermo-lengths" type="text" placeholder="4,4,4,5" aria-describedby="${prefix}lengths-help ${prefix}generation-error"><p id="${prefix}lengths-help" class="muted">Comma-separated cell counts, including each bulb. Enter one length per thermometer, or leave blank for automatic lengths.</p></div>
      <label><input id="${prefix}no-givens" type="checkbox"> No given cells</label>
      <label><input id="${prefix}logical-only" type="checkbox"> Logical techniques only (no Brute force)</label>
      <label><input id="${prefix}branching" type="checkbox"> Branching thermometers (shared bulb)</label>
      <label>Branches per bulb <select id="${prefix}branches-per-bulb" aria-describedby="${prefix}branches-help"><option value="">Automatic (2 or 3)</option>${[2,3,4,5,6,7,8].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>
      <p id="${prefix}branches-help" class="muted">Choose a fixed number for every bulb, or automatic groups of two or three. With a fixed number and no exact lengths, generate one bulb (a pair with rotational symmetry). Each exact length counts one branch, including its bulb. Missing Thermometer branches share one hidden bulb at their common starting endpoint.</p>
      <label><input id="${prefix}symmetric-thermos" type="checkbox"> Rotationally symmetric thermometers</label>
    </div>
`;
}
