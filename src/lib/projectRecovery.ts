/** IndexedDB journals incremental edits before a network round trip completes.
 * Entries are removed only after a save containing them is acknowledged. */
export async function openProjectRecovery(projectId: string) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('propflow-recovery', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('updates', { keyPath: 'id', autoIncrement: true });
      store.createIndex('projectId', 'projectId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  type Entry = { id: number; projectId: string; update: Uint8Array };
  const entries = await new Promise<Entry[]>((resolve, reject) => {
    const request = db.transaction('updates').objectStore('updates').index('projectId').getAll(projectId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // Track only recovered records and this editor's writes. Another tab's newer
  // edits must never be cleared by our acknowledgment.
  const pending = new Set(entries.map(entry => entry.id));
  let writes: Promise<unknown> = Promise.resolve();
  let closed = false;
  return {
    updates: entries.map(entry => entry.update),
    append(update: Uint8Array) {
      if (closed) return;
      const copy = update.slice();
      writes = writes.catch(() => {}).then(() => new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('updates', 'readwrite');
        const request = transaction.objectStore('updates').add({ projectId, update: copy });
        request.onsuccess = () => pending.add(request.result as number);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }));
      // Storage failure leaves the document dirty and the network retry active.
      void writes.catch(error => console.error('Local edit backup failed', error));
    },
    async capture(): Promise<number[]> {
      await writes;
      return [...pending];
    },
    async acknowledge(ids: number[]) {
      if (closed || !ids.length) return;
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('updates', 'readwrite');
        const store = transaction.objectStore('updates');
        ids.forEach(id => store.delete(id));
        transaction.oncomplete = () => { ids.forEach(id => pending.delete(id)); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      });
    },
    close() {
      closed = true;
      // Let already-queued journal transactions finish before closing.
      void writes.finally(() => db.close()).catch(() => {});
    },
  };
}
