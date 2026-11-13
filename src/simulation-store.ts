import type { Puzzle } from './puzzle';
export interface SimulationMatch { trial: number; puzzle: Puzzle; score: number; hardest: string }
export async function openSimulationStore() {
  const scope = crypto.randomUUID();
  const range = IDBKeyRange.bound([scope, 0], [scope, Number.MAX_SAFE_INTEGER]);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('thermo-simulation', 2);
    request.onupgradeneeded = () => {
      if (request.result.objectStoreNames.contains('matches')) request.result.deleteObjectStore('matches');
      request.result.createObjectStore('matches', { keyPath: ['scope', 'trial'] });
    };
    request.onblocked = () => reject(new Error('Simulation storage is busy in another tab.'));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const write = (action: (store: IDBObjectStore) => void) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction('matches', 'readwrite');
    action(tx.objectStore('matches'));
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
  });
  return {
    clear: () => write(s => { s.delete(range); }),
    add: (match: SimulationMatch) => write(s => { s.put({ ...match, scope }); }),
    page: (offset: number, limit: number) => new Promise<SimulationMatch[]>((resolve, reject) => {
      const tx = db.transaction('matches', 'readonly'), request = tx.objectStore('matches').openCursor(range);
      const rows: SimulationMatch[] = []; let skipped = false;
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || rows.length === limit) { resolve(rows); return; }
        if (!skipped && offset) { skipped = true; cursor.advance(offset); return; }
        rows.push(cursor.value); cursor.continue();
      };
    }),
  };
}
