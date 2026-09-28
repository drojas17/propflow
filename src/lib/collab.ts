import * as Y from 'yjs';
import { UndoManager } from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ProjectDoc } from './db';

/**
 * Yjs collaboration engine for PropFlow.
 *
 * One Y.Doc per project. The doc mirrors the React state the editor already
 * renders (nodes/edges/shapes/canvas/sop) so the UI keeps working unchanged:
 *
 *   React state --(diff, origin 'local')--> Y.Doc --(broadcast)--> peers
 *   peers --(broadcast)--> Y.Doc --(read back)--> React state
 *
 * Undo is a local-origin Y.UndoManager over the doc maps, which replaces the
 * old full-snapshot stack (that stack would have clobbered collaborators'
 * concurrent edits on undo).
 */

export interface CollabDoc {
  doc: Y.Doc;
  nodes: Y.Map<unknown>;
  edges: Y.Map<unknown>;
  shapes: Y.Map<unknown>;
  meta: Y.Map<unknown>;
  undoManager: UndoManager;
  awareness: Awareness;
}

export interface DocState {
  nodes: { id: string }[];
  edges: { id: string }[];
  shapes: { id: string }[];
  canvasSize: { w: number; h: number };
  sop: unknown;
}

export interface PeerPresence {
  clientId: number;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string[];
}

export function createCollabDoc(): CollabDoc {
  const doc = new Y.Doc();
  const nodes = doc.getMap<unknown>('nodes');
  const edges = doc.getMap<unknown>('edges');
  const shapes = doc.getMap<unknown>('shapes');
  const meta = doc.getMap<unknown>('meta');
  // captureTimeout merges a rapid burst (e.g. one drag gesture) into a single undo step.
  const undoManager = new UndoManager([nodes, edges, shapes, meta], {
    trackedOrigins: new Set(['local']),
    captureTimeout: 500,
  });
  const awareness = new Awareness(doc);
  return { doc, nodes, edges, shapes, meta, undoManager, awareness };
}

/** JSON round-trip: strips `undefined` (Yjs can't store it) and detaches shared types. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toJSON(value: unknown): unknown {
  if (value && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return (value as { toJSON: () => unknown }).toJSON();
  }
  return value;
}

/** Load a project snapshot into the doc. Origin 'init' is ignored by sync/undo. */
export function projectToDoc(c: CollabDoc, project: ProjectDoc): void {
  c.doc.transact(
    () => {
      c.nodes.clear();
      for (const n of project.nodes as { id: string }[]) c.nodes.set(n.id, clean(n));
      c.edges.clear();
      for (const e of project.edges as { id: string }[]) c.edges.set(e.id, clean(e));
      c.shapes.clear();
      for (const s of project.shapes as { id: string }[]) c.shapes.set(s.id, clean(s));
      c.meta.set('canvasSize', clean(project.canvasSize ?? { w: 850, h: 580 }));
      c.meta.set('sop', project.sop == null ? null : clean(project.sop));
    },
    'init'
  );
}

/** Serialize the whole doc back to the SavedProject JSON shape (also the DB format). */
export function docToProject(c: CollabDoc): ProjectDoc {
  const values = (m: Y.Map<unknown>) => [...m.values()].map((v) => clean(toJSON(v)));
  const canvasSize = toJSON(c.meta.get('canvasSize')) as { w: number; h: number } | undefined;
  const sop = toJSON(c.meta.get('sop'));
  return {
    nodes: values(c.nodes),
    edges: values(c.edges),
    shapes: values(c.shapes),
    canvasSize: canvasSize ?? { w: 850, h: 580 },
    sop: sop ?? null,
  };
}

/** Read the doc into plain React-state-shaped data. */
export function readDocState(c: CollabDoc): DocState {
  const p = docToProject(c);
  return {
    nodes: p.nodes as { id: string }[],
    edges: p.edges as { id: string }[],
    shapes: p.shapes as { id: string }[],
    canvasSize: p.canvasSize,
    sop: p.sop,
  };
}

function diffIdMap(ymap: Y.Map<unknown>, items: { id: string }[]): boolean {
  const nextIds = new Set(items.map((i) => i.id));
  let changed = false;
  ymap.forEach((_v, id) => {
    if (!nextIds.has(id)) changed = true;
  });
  for (const item of items) {
    const cur = ymap.get(item.id);
    if (cur === undefined) {
      changed = true;
    } else {
      const cleanItem = clean(item);
      if (JSON.stringify(toJSON(cur)) !== JSON.stringify(cleanItem)) changed = true;
    }
  }
  return changed;
}

/**
 * Diff React state into the doc inside one 'local' transaction (tracked by the
 * UndoManager). Returns false when nothing changed, so callers can skip work.
 */
export function pushStateToDoc(c: CollabDoc, state: DocState): boolean {
  const nextCanvas = clean(state.canvasSize);
  const nextSop = state.sop == null ? null : clean(state.sop);
  const canvasChanged =
    JSON.stringify(toJSON(c.meta.get('canvasSize'))) !== JSON.stringify(nextCanvas);
  const sopChanged = JSON.stringify(toJSON(c.meta.get('sop')) ?? null) !== JSON.stringify(nextSop);
  const changed =
    diffIdMap(c.nodes, state.nodes) ||
    diffIdMap(c.edges, state.edges) ||
    diffIdMap(c.shapes, state.shapes) ||
    canvasChanged ||
    sopChanged;
  if (!changed) return false;

  c.doc.transact(
    () => {
      const syncMap = (ymap: Y.Map<unknown>, items: { id: string }[]) => {
        const nextIds = new Set(items.map((i) => i.id));
        const doomed: string[] = [];
        ymap.forEach((_v, id) => {
          if (!nextIds.has(id)) doomed.push(id);
        });
        for (const id of doomed) ymap.delete(id);
        for (const item of items) ymap.set(item.id, clean(item));
      };
      syncMap(c.nodes, state.nodes);
      syncMap(c.edges, state.edges);
      syncMap(c.shapes, state.shapes);
      if (canvasChanged) c.meta.set('canvasSize', nextCanvas);
      if (sopChanged) c.meta.set('sop', nextSop);
    },
    'local'
  );
  return true;
}

// ---------------------------------------------------------------- binary <-> base64 (Broadcast payloads must be JSON)

export function encodeUpdate(update: Uint8Array): string {
  let s = '';
  for (let i = 0; i < update.length; i += 0x8000) {
    s += String.fromCharCode(...update.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function decodeUpdate(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------- presence

const IDENTITY_NAMES = [
  'Amber Fox', 'Teal Tiger', 'Coral Crab', 'Indigo Iguana', 'Jade Jaguar',
  'Onyx Otter', 'Ruby Robin', 'Slate Seal', 'Topaz Toucan', 'Violet Viper',
];
const IDENTITY_COLORS = [
  '#55d7ff', '#ffd166', '#ef476f', '#06d6a0', '#b388ff',
  '#ff9f1c', '#80ed99', '#f72585', '#4cc9f0', '#e0aaff',
];

export function makeIdentity(): { name: string; color: string } {
  const i = Math.floor(Math.random() * IDENTITY_NAMES.length);
  return { name: IDENTITY_NAMES[i], color: IDENTITY_COLORS[i % IDENTITY_COLORS.length] };
}

export function setLocalPresence(
  c: CollabDoc,
  identity: { name: string; color: string },
  cursor: { x: number; y: number } | null,
  selection: string[]
): void {
  c.awareness.setLocalState({ user: identity, cursor, selection });
}

export function readPeers(c: CollabDoc): PeerPresence[] {
  const peers: PeerPresence[] = [];
  for (const [clientId, state] of c.awareness.getStates()) {
    if (clientId === c.doc.clientID || !state) continue;
    const s = state as {
      user?: { name?: string; color?: string };
      cursor?: { x: number; y: number } | null;
      selection?: string[];
    };
    peers.push({
      clientId,
      name: s.user?.name ?? 'Anonymous',
      color: s.user?.color ?? '#55d7ff',
      cursor: s.cursor ?? null,
      selection: s.selection ?? [],
    });
  }
  return peers;
}

// ---------------------------------------------------------------- realtime channel

export interface SyncHooks {
  /** A remote Yjs update was applied to the doc; re-read it into React state. */
  onRemoteUpdate: (update: Uint8Array) => void;
  /** Remote presence changed; re-read peers. */
  onPeersChanged: () => void;
  /** Channel is live: load the DB snapshot into the doc, then resolve. */
  onSubscribed: () => Promise<void>;
}

export interface SyncHandle {
  broadcastUpdate: (update: Uint8Array) => void;
  leave: () => void;
}

function payloadOf(msg: unknown): { u?: string } {
  return ((msg as { payload?: { u?: string } }).payload ?? {}) as { u?: string };
}

/**
 * Join the per-project Broadcast channel. Remote Yjs updates received before
 * the DB snapshot finishes loading are buffered and replayed after, so a
 * joiner can never miss an edit that landed mid-load.
 */
export function attachRealtimeSync(
  sb: SupabaseClient,
  projectId: string,
  collab: CollabDoc,
  hooks: SyncHooks
): SyncHandle {
  let live = false;
  const buffered: Uint8Array[] = [];
  const channel: RealtimeChannel = sb.channel(`propflow:project:${projectId}`, {
    config: { broadcast: { ack: false } },
  });

  const broadcastUpdate = (update: Uint8Array) => {
    if (!live) return;
    void channel.send({ type: 'broadcast', event: 'yjs-update', payload: { u: encodeUpdate(update) } });
  };

  channel.on('broadcast', { event: 'yjs-update' }, (msg) => {
    const u = payloadOf(msg).u;
    if (!u) return;
    try {
      const update = decodeUpdate(u);
      if (live) hooks.onRemoteUpdate(update);
      else buffered.push(update);
    } catch {
      /* ignore malformed payloads */
    }
  });

  channel.on('broadcast', { event: 'awareness' }, (msg) => {
    const u = payloadOf(msg).u;
    if (!u) return;
    try {
      applyAwarenessUpdate(collab.awareness, decodeUpdate(u), 'remote');
    } catch {
      /* ignore malformed payloads */
    }
  });

  const onAwarenessUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    if (!live) return;
    const update = encodeAwarenessUpdate(collab.awareness, [...added, ...updated, ...removed]);
    void channel.send({ type: 'broadcast', event: 'awareness', payload: { u: encodeUpdate(update) } });
  };
  collab.awareness.on('update', onAwarenessUpdate);
  const onAwarenessChange = () => hooks.onPeersChanged();
  collab.awareness.on('change', onAwarenessChange);

  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    void (async () => {
      await hooks.onSubscribed();
      live = true;
      for (const update of buffered) hooks.onRemoteUpdate(update);
      buffered.length = 0;
      // Re-announce presence now that broadcast is actually up.
      const local = collab.awareness.getLocalState();
      collab.awareness.setLocalState(local ? { ...local } : null);
    })();
  });

  const leave = () => {
    try {
      collab.awareness.setLocalState(null);
    } catch {
      /* already torn down */
    }
    collab.awareness.off('update', onAwarenessUpdate);
    collab.awareness.off('change', onAwarenessChange);
    void channel.unsubscribe();
  };

  return { broadcastUpdate, leave };
}
