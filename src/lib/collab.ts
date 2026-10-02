import * as Y from 'yjs';
import { UndoManager } from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ProjectDoc, Part } from './db';

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
  parts: Y.Map<unknown>;
  meta: Y.Map<unknown>;
  undoManager: UndoManager;
  awareness: Awareness;
}

export interface DocState {
  nodes: { id: string }[];
  edges: { id: string }[];
  shapes: { id: string }[];
  parts?: Part[];
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
  const parts = doc.getMap<unknown>('parts');
  const meta = doc.getMap<unknown>('meta');
  // captureTimeout merges a rapid burst (e.g. one drag gesture) into a single undo step.
  const undoManager = new UndoManager([nodes, edges, shapes, meta], {
    trackedOrigins: new Set(['local']),
    captureTimeout: 500,
  });
  const awareness = new Awareness(doc);
  return { doc, nodes, edges, shapes, parts, meta, undoManager, awareness };
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
      c.parts.clear();
      for (const p of (project.parts ?? []) as { id: string }[]) c.parts.set(p.id, clean(p));
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
    parts: values(c.parts) as Part[],
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
    parts: (p.parts ?? []) as Part[],
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
 *
 * Only actually-new/changed/deleted keys are written: re-setting every key
 * would churn the whole struct history on every keystroke and bloat updates.
 */
export function pushStateToDoc(c: CollabDoc, state: DocState, base?: DocState | null): boolean {
  const nextCanvas = clean(state.canvasSize);
  const nextSop = state.sop == null ? null : clean(state.sop);
  const canvasChanged = JSON.stringify(toJSON(c.meta.get('canvasSize'))) !== JSON.stringify(nextCanvas);
  const sopChanged = JSON.stringify(toJSON(c.meta.get('sop')) ?? null) !== JSON.stringify(nextSop);
  const changed =
    diffIdMap(c.nodes, state.nodes) ||
    diffIdMap(c.edges, state.edges) ||
    diffIdMap(c.shapes, state.shapes) ||
    canvasChanged ||
    sopChanged;
  if (!changed) return false;

  // Deletion guard: only keys this client previously pushed (present in `base`)
  // may be deleted. A stale snapshot must never delete entities it simply has
  // not seen yet (e.g. a collaborator's newer nodes) — those survive as adds.
  const baseIds = (items?: { id: string }[] | null) => new Set((items ?? []).map((i) => i.id));

  c.doc.transact(
    () => {
      const syncMap = (
        ymap: Y.Map<unknown>,
        items: { id: string }[],
        deletable: Set<string> | null
      ) => {
        const nextIds = new Set(items.map((i) => i.id));
        const doomed: string[] = [];
        ymap.forEach((_v, id) => {
          if (!nextIds.has(id) && (!deletable || deletable.has(id))) doomed.push(id);
        });
        for (const id of doomed) ymap.delete(id);
        for (const item of items) {
          const cleaned = clean(item);
          const cur = ymap.get(item.id);
          if (cur === undefined || JSON.stringify(toJSON(cur)) !== JSON.stringify(cleaned)) {
            ymap.set(item.id, cleaned);
          }
        }
      };
      const b = base ?? null;
      syncMap(c.nodes, state.nodes, b ? baseIds(b.nodes) : null);
      syncMap(c.edges, state.edges, b ? baseIds(b.edges) : null);
      syncMap(c.shapes, state.shapes, b ? baseIds(b.shapes) : null);
      if (canvasChanged) c.meta.set('canvasSize', nextCanvas);
      if (sopChanged) c.meta.set('sop', nextSop);
    },
    'local'
  );
  return true;
}

/**
 * Three-way merge of a remotely-persisted project snapshot into the live doc.
 * `base` is the last state this client pushed (or hydrated from); entities the
 * local side changed since base win, everything else takes the remote value.
 * Remote deletes apply only to entities that were in base AND are still
 * untouched locally. Returns whether the doc changed. Never throws on
 * malformed input.
 */
export function mergeRemoteProject(c: CollabDoc, remote: ProjectDoc, base: DocState | null): boolean {
  let changed = false;
  const mergeMap = (
    ymap: Y.Map<unknown>,
    baseItems: { id: string }[] | undefined | null,
    remoteItems: { id: string }[] | undefined | null
  ) => {
    const rjson = (v: unknown) => JSON.stringify(clean(v as { id: string }));
    const baseById = new Map((baseItems ?? []).map((i) => [i.id, rjson(i)] as [string, string]));
    const remoteById = new Map((remoteItems ?? []).map((i) => [i.id, rjson(i)] as [string, string]));
    for (const [id, rj] of remoteById) {
      const cur = ymap.get(id);
      if (cur === undefined) {
        ymap.set(id, JSON.parse(rj));
        changed = true;
      } else {
        const cj = JSON.stringify(toJSON(cur));
        if (cj === rj) continue;
        const bj = baseById.get(id);
        if (bj === undefined || cj === bj) {
          // new remotely, or locally untouched since base → take remote
          ymap.set(id, JSON.parse(rj));
          changed = true;
        }
        // else both sides changed the same entity → keep local
      }
    }
    for (const [id, bj] of baseById) {
      if (remoteById.has(id)) continue;
      const cur = ymap.get(id);
      if (cur !== undefined && JSON.stringify(toJSON(cur)) === bj) {
        ymap.delete(id);
        changed = true;
      }
      // else locally changed/added since base → keep local (protects against
      // a stale remote snapshot wiping local work)
    }
  };
  const mergeMeta = (key: string, baseVal: unknown, remoteVal: unknown) => {
    const rj = JSON.stringify(remoteVal ?? null);
    const cj = JSON.stringify(toJSON(c.meta.get(key)) ?? null);
    if (cj === rj) return;
    if (cj === JSON.stringify(baseVal ?? null)) {
      c.meta.set(key, remoteVal == null ? null : clean(remoteVal));
      changed = true;
    }
    // else both changed → keep local
  };
  c.doc.transact(() => {
    mergeMap(c.nodes, base?.nodes, (remote.nodes ?? []) as { id: string }[]);
    mergeMap(c.edges, base?.edges, (remote.edges ?? []) as { id: string }[]);
    mergeMap(c.shapes, base?.shapes, (remote.shapes ?? []) as { id: string }[]);
    mergeMeta('canvasSize', base?.canvasSize, remote.canvasSize);
    mergeMeta('sop', base?.sop ?? null, remote.sop ?? null);
  }, 'remote');
  return changed;
}

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
  c.awareness.setLocalState({ user: identity, cursor, selection, lastActive: Date.now() });
}

export function readPeers(c: CollabDoc): PeerPresence[] {
  const peers: PeerPresence[] = [];
  for (const [clientId, state] of c.awareness.getStates()) {
    if (clientId === c.doc.clientID || !state) continue;
    const s = state as {
      user?: { name?: string; color?: string };
      cursor?: { x: number; y: number } | null;
      selection?: string[];
      lastActive?: number;
    };
    // Drop stale presence: client hasn't announced in 30s (crashed, closed laptop, etc.)
    if (Date.now() - (s.lastActive ?? 0) > 30000) continue;
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
  /** A remote Yjs update arrived and the doc is hydrated; apply it. */
  onRemoteUpdate: (update: Uint8Array) => void;
  /** Remote presence changed; re-read peers. */
  onPeersChanged: () => void;
  /** Realtime channel is live (informational; hydration is independent). */
  onRealtimeUp: () => void;
}

export interface SyncHandle {
  broadcastUpdate: (update: Uint8Array) => void;
  /** Call after the DB snapshot has been loaded into the doc. Replays any
   * updates that arrived mid-load. Idempotent. */
  setHydrated: () => void;
  leave: () => void;
}

function payloadOf(msg: unknown): { u?: string } {
  return ((msg as { payload?: { u?: string } }).payload ?? {}) as { u?: string };
}

/**
 * Join the per-project Broadcast channel. DB hydration is independent of the
 * realtime connection: the app loads the snapshot from Postgres immediately
 * and calls setHydrated(), while remote updates that arrive early are buffered
 * and replayed after. If Realtime never connects, the app still works as a
 * single-user Supabase-backed editor.
 */
export function attachRealtimeSync(
  sb: SupabaseClient,
  projectId: string,
  collab: CollabDoc,
  hooks: SyncHooks
): SyncHandle {
  let live = false;
  let hydrated = false;
  let left = false;
  const buffered: Uint8Array[] = [];
  const topic = `propflow:project:${projectId}`;
  let channel: RealtimeChannel | null = null;
  let gen = 0;
  let joinPending = false;



  const broadcastUpdate = (update: Uint8Array) => {
    if (!live || !channel) return;
    void channel.send({ type: 'broadcast', event: 'yjs-update', payload: { u: encodeUpdate(update) } });
  };

  const onYjsBroadcast = (msg: unknown) => {
    const u = payloadOf(msg).u;
    if (!u) return;
    try {
      const update = decodeUpdate(u);
      if (live && hydrated) hooks.onRemoteUpdate(update);
      else buffered.push(update);
    } catch {
      /* ignore malformed payloads */
    }
  };

  /**
   * Full-state handshake. Every client builds its Y.Doc independently from the
   * same DB snapshot, so incremental updates alone can never integrate: a
   * `Y.Map.set` that replaces a key links the new struct to the old one via
   * `origin`, and peers never received each other's independent init structs.
   * Exchanging full states gives every peer the complete struct history, after
   * which incremental updates integrate cleanly.
   */
  const broadcastSyncState = () => {
    if (!live || !hydrated || !channel) return;
    try {
      const full = Y.encodeStateAsUpdate(collab.doc);
      void channel.send({
        type: 'broadcast',
        event: 'sync-state',
        payload: { u: encodeUpdate(full) },
      });
    } catch {
      /* best effort */
    }
  };

  const broadcastSyncRequest = () => {
    if (!live || !channel) return;
    void channel.send({ type: 'broadcast', event: 'sync-request', payload: {} });
  };

  /** Exchange full states whenever we become ready (hydrated + live). */
  const maybeHandshake = () => {
    if (live && hydrated) {
      broadcastSyncRequest();
      broadcastSyncState();
    }
  };

  const onSyncRequest = () => {
    // Answer with our full state so the requester gets our struct history.
    broadcastSyncState();
  };

  const onSyncState = (msg: unknown) => {
    const u = payloadOf(msg).u;
    if (!u) return;
    try {
      const update = decodeUpdate(u);
      // A full state is just a (large) update; the normal remote path applies
      // it without rebroadcasting and syncs it into React.
      if (live && hydrated) hooks.onRemoteUpdate(update);
      else buffered.push(update);
    } catch {
      /* ignore malformed payloads */
    }
  };

  const onAwarenessBroadcast = (msg: unknown) => {
    const u = payloadOf(msg).u;
    if (!u) return;
    try {
      applyAwarenessUpdate(collab.awareness, decodeUpdate(u), 'remote');
    } catch {
      /* ignore malformed payloads */
    }
  };

  const onAwarenessUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    if (!live || !channel) return;
    const update = encodeAwarenessUpdate(collab.awareness, [...added, ...updated, ...removed]);
    void channel.send({ type: 'broadcast', event: 'awareness', payload: { u: encodeUpdate(update) } });
  };
  collab.awareness.on('update', onAwarenessUpdate);
  const onAwarenessChange = () => hooks.onPeersChanged();
  collab.awareness.on('change', onAwarenessChange);

  /** Join (or rejoin) the channel. Each attempt uses a FRESH channel object:
   * re-subscribing a dropped channel instance is unreliable, and a dropped
   * tab must never silently stop syncing. */
  const join = () => {
    if (left) return;
    joinPending = false;
    const myGen = ++gen;
    const ch = sb.channel(topic, { config: { broadcast: { ack: false } } });
    channel = ch;
    ch.on('broadcast', { event: 'yjs-update' }, onYjsBroadcast);
    ch.on('broadcast', { event: 'awareness' }, onAwarenessBroadcast);
    ch.on('broadcast', { event: 'sync-request' }, onSyncRequest);
    ch.on('broadcast', { event: 'sync-state' }, onSyncState);
    ch.subscribe((status) => {
      if (myGen !== gen || left) return; // superseded by a newer join, or torn down
      if (status === 'SUBSCRIBED') {
        live = true;
        hooks.onRealtimeUp();
        // Now that broadcast is up, exchange full Yjs states so incremental
        // updates from peers integrate (see handshake note above).
        maybeHandshake();
        // Re-announce presence now that broadcast is actually up.
        const local = collab.awareness.getLocalState();
        collab.awareness.setLocalState(local ? { ...local } : null);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        live = false;
        gen++; // supersede this channel so its own unsubscribe-close is ignored
        try {
          void ch.unsubscribe();
        } catch {
          /* best effort */
        }
        if (!joinPending) {
          joinPending = true;
          globalThis.setTimeout(join, 1500);
        }
      }
    });
  };
  join();

  // Watchdog: if we somehow end up not-live without a pending rejoin (e.g. a
  // missed callback), force a fresh join. Cheap insurance against silent desync.
  const watchdog = globalThis.setInterval(() => {
    if (!left && !live && !joinPending) {
      joinPending = true;
      gen++;
      try {
        void channel?.unsubscribe();
      } catch {
        /* best effort */
      }
      join();
    }
  }, 10000);

  const setHydrated = () => {
    if (hydrated) return;
    hydrated = true;
    for (const update of buffered) hooks.onRemoteUpdate(update);
    buffered.length = 0;
    // The DB snapshot is in the doc; exchange full states so this client's
    // independent struct history is known to peers (and vice versa).
    maybeHandshake();
  };

  const leave = () => {
    left = true;
    globalThis.clearInterval(watchdog);
    try {
      collab.awareness.setLocalState(null);
    } catch {
      /* already torn down */
    }
    collab.awareness.off('update', onAwarenessUpdate);
    collab.awareness.off('change', onAwarenessChange);
    const ch = channel;
    channel = null;
    if (ch) void ch.unsubscribe();
  };

  return { broadcastUpdate, setHydrated, leave };
}

export interface DbSyncHooks {
  onRemoteDoc: (doc: ProjectDoc, updatedAt: string) => void;
}

/**
 * Reliable cross-computer doc sync via Postgres Changes.
 *
 * The Yjs-over-Broadcast path is best-effort and can miss updates (handshake
 * races, dropped messages). This subscription fires whenever ANY client
 * persists the project to the DB, guaranteeing eventual consistency:
 * the notified client fetches the latest doc and merges it into its Yjs doc.
 * Typical latency is ~1.5s (1s persist debounce + notification + fetch).
 */
export function attachDbSync(
  sb: SupabaseClient,
  projectId: string,
  hooks: DbSyncHooks
): { leave: () => void } {
  let left = false;
  const channel = sb
    .channel(`propflow:db:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'project_documents',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        if (left) return;
        const row = payload.new as { doc?: ProjectDoc; updated_at?: string } | undefined;
        if (row?.doc && row?.updated_at) {
          try {
            hooks.onRemoteDoc(row.doc, row.updated_at);
          } catch (e) {
            console.error('onRemoteDoc failed', e);
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug(`[db-sync] subscribed for ${projectId}`);
      }
    });

  return {
    leave: () => {
      left = true;
      try {
        void sb.removeChannel(channel);
      } catch {
        /* ignore */
      }
    },
  };
}
