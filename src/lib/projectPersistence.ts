import * as Y from 'yjs';
import type { ProjectDoc, ProjectSnapshot } from './db';
import { createCollabDoc, projectToDoc, docToProject, encodeUpdate, decodeUpdate, mergeRemoteProject, type CollabDoc, type DocState } from './collab';

export interface ProjectStore {
  load: () => Promise<ProjectSnapshot | null>;
  compareAndSwap: (doc: ProjectDoc, previous: ProjectSnapshot | null) => Promise<ProjectSnapshot | null>;
}

async function requestWithTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Saving timed out. Changes remain backed up in this browser and will retry.')), 15000);
    })]);
  } finally { clearTimeout(timer); }
}

export function persistedProject(c: CollabDoc): ProjectDoc {
  return { ...docToProject(c), _collab: { version: 1, state: encodeUpdate(Y.encodeStateAsUpdate(c.doc)) } };
}

/** Every joiner loads the SAME history, rather than manufacturing competing seeds. */
export function restoreProject(c: CollabDoc, project: ProjectDoc): void {
  if (project._collab?.version === 1) Y.applyUpdate(c.doc, decodeUpdate(project._collab.state), 'init');
  else projectToDoc(c, project);
}

/** Upgrade legacy JSON once, using CAS so simultaneous first joins share one seed. */
export async function loadCanonicalProject(store: ProjectStore, normalize: (doc: ProjectDoc) => ProjectDoc = doc => doc): Promise<ProjectSnapshot> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const current = await requestWithTimeout(store.load());
    if (current?.doc._collab?.version === 1) return current;
    const c = createCollabDoc();
    try {
      projectToDoc(c, normalize(current?.doc ?? { nodes: [], edges: [], shapes: [], canvasSize: { w: 850, h: 580 }, sop: null }));
      const saved = await requestWithTimeout(store.compareAndSwap(persistedProject(c), current));
      if (saved) return saved;
    } finally {
      c.awareness.destroy();
      c.doc.destroy();
    }
  }
  throw new Error('The project is busy. Please try opening it again.');
}

export function mergePersistedProject(c: CollabDoc, remote: ProjectDoc, base: ProjectDoc | null): void {
  if (remote._collab?.version === 1) {
    Y.applyUpdate(c.doc, decodeUpdate(remote._collab.state), 'remote');
    // Remove pipes whose endpoints were concurrently deleted. Free stubs survive.
    c.doc.transact(() => {
      for (const [id, value] of c.edges) {
        const edge = value as { from?: string; to?: string };
        if ((edge.from && !c.nodes.has(edge.from)) || (edge.to && !c.nodes.has(edge.to))) c.edges.delete(id);
      }
    }, 'remote');
  } else {
    // A still-open pre-upgrade client can write legacy JSON. Keep our history
    // and reconcile that snapshot; never exchange old independent Yjs seeds.
    mergeRemoteProject(c, remote, base as DocState | null);
  }
}

/** One save in flight per editor. CAS retries merge the winning CRDT history. */
export function createProjectPersistence(c: CollabDoc, store: ProjectStore, hooks: {
  onAcknowledged: (hash: string) => void;
  isActive: () => boolean;
}) {
  let inFlight: Promise<void> | null = null;
  let base: ProjectDoc | null = null;
  let acknowledged = '';
  const run = async () => {
    for (let attempt = 0; attempt < 20 && hooks.isActive(); attempt++) {
      // Fail closed on read errors. Never replace unknown server content.
      const current = await requestWithTimeout(store.load());
      if (!hooks.isActive()) return;
      if (current) mergePersistedProject(c, current.doc, base);
      const snapshot = persistedProject(c);
      const { _collab, ...content } = snapshot;
      const hash = JSON.stringify(content);
      if (current && current.doc._collab?.state === _collab?.state) {
        base = current.doc;
        acknowledged = hash;
        hooks.onAcknowledged(hash);
        return;
      }
      const saved = await requestWithTimeout(store.compareAndSwap(snapshot, current));
      if (!hooks.isActive()) return;
      if (!saved) continue;
      base = saved.doc;
      acknowledged = hash;
      hooks.onAcknowledged(hash);
      // Edits during the request are still dirty. Drain them before resolving
      // a manual save/project switch, instead of falsely showing "saved".
      if (JSON.stringify(docToProject(c)) === hash) return;
    }
    if (hooks.isActive()) throw new Error('The project kept changing while saving. Your changes are still pending; retrying.');
  };
  return {
    setBase(snapshot: ProjectDoc) { base = snapshot; },
    get acknowledgedHash() { return acknowledged; },
    save(): Promise<void> {
      if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
