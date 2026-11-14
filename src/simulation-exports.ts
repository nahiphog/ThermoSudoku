import { encodePuzzle } from './puzzle-string';
import { gridImage } from './grid-image';
import type { Puzzle } from './puzzle';

/** Export the givens and thermometer paths shown in this particular trial card. */
export function addSimulationExports(card: HTMLElement, puzzle: Puzzle, trial: number) {
  const controls = document.createElement('div');
  controls.innerHTML = `<div class="button-pair"><button type="button" class="outline" data-copy="image">Copy grid as an image</button><button type="button" class="outline" data-copy="string">Copy grid as a string</button></div><p class="muted" role="status" aria-live="polite"></p><textarea readonly aria-label="Puzzle string to copy" hidden></textarea>`;
  card.append(controls);
  const status = controls.querySelector('p')!, fallback = controls.querySelector('textarea')!;
  controls.querySelector<HTMLButtonElement>('[data-copy="string"]')!.onclick = async () => {
    const text = encodePuzzle(puzzle); fallback.hidden = true;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Puzzle string copied.';
    } catch {
      fallback.value = text; fallback.hidden = false; fallback.select();
      status.textContent = 'Clipboard unavailable. Select and copy the puzzle string below.';
    }
  };
  controls.querySelector<HTMLButtonElement>('[data-copy="image"]')!.onclick = async () => {
    const png = gridImage(puzzle, [...puzzle.givens]);
    // Attach a rejection handler immediately, even if clipboard access fails first.
    void png.catch(() => {});
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Clipboard unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      status.textContent = 'Grid image copied.';
    } catch {
      try {
        const url = URL.createObjectURL(await png), link = document.createElement('a');
        link.href = url; link.download = `thermo-trial-${trial}.png`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = 'Clipboard unavailable. Grid image downloaded.';
      } catch { status.textContent = 'Could not create the grid image. Please try again.'; }
    }
  };
}
