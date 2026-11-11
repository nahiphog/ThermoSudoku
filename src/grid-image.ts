import type { Puzzle } from './puzzle';

/** Draw the visible grid independently of DOM selection, fonts, and screen size. */
export function gridImage(puzzle: Puzzle, values: number[]): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 904;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Image creation is unavailable.'));
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 904, 904); ctx.translate(2, 2);
  const x = (c: number) => (c % 9) * 100 + 50, y = (c: number) => Math.floor(c / 9) * 100 + 50;
  ctx.strokeStyle = ctx.fillStyle = '#d0d0d3'; ctx.lineWidth = 32; ctx.lineCap = ctx.lineJoin = 'round';
  for (const t of puzzle.thermos) {
    ctx.beginPath(); ctx.moveTo(x(t[0]), y(t[0])); for (const c of t.slice(1)) ctx.lineTo(x(c), y(c)); ctx.stroke();
    ctx.beginPath(); ctx.arc(x(t[0]), y(t[0]), 34, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'butt';
  for (let i = 0; i <= 9; i++) {
    ctx.lineWidth = i % 3 === 0 ? 4 : 1; ctx.strokeStyle = i % 3 === 0 ? '#45454b' : '#dcdce1';
    ctx.beginPath(); ctx.moveTo(i * 100, 0); ctx.lineTo(i * 100, 900); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 100); ctx.lineTo(900, i * 100); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  values.forEach((d, c) => {
    if (!d) return;
    ctx.fillStyle = puzzle.givens[c] ? '#292c33' : '#6553a6';
    ctx.font = `${puzzle.givens[c] ? 700 : 500} 48px sans-serif`; ctx.fillText(String(d), x(c), y(c) + 2);
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create PNG image.')), 'image/png'));
}
