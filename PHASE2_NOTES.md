# Phase 2 — Supabase persistence + Yjs realtime collaboration

Branch: `phase-2-supabase-yjs` (do not push until reviewed)
Date: 2026-09-28

## What changed

**Removed**
- All Google OAuth / session / domain logic from `vite.config.ts` dev middleware.
- Disk-backed `/api/projects`, `/api/project/:id`, `/api/library` middleware.
- Snapshot-stack undo (`history.current`) — replaced by Yjs `UndoManager`.
- 300 ms whole-document PUT autosave — replaced by Yjs sync + debounced snapshot persist.

**Added**
- `src/lib/supabase.ts` — lazy Supabase client (`getSupabase()` / `requireSupabase()`),
  safe to import when env vars are missing or in public-only mode.
- `src/lib/db.ts` — data-access layer over Supabase tables:
  - `listProjects`, `ensureProject`, `loadProjectDoc`, `saveProjectDoc`
  - `loadLibrary`, `saveLibraryDoc` (`global_library`, single row)
  - `createShareLink` / `resolveShareToken` (`share_links`; tokens are 32 random
    bytes, only the SHA-256 hash is stored; links are read-only + expiring)
- `src/lib/collab.ts` — Yjs v13 engine:
  - one `Y.Doc` per open project; maps for nodes / edges / shapes / meta
  - `UndoManager` scoped to local origin only (`trackedOrigins: new Set(['local'])`)
  - `Awareness` presence: identity (random name + color), cursor, selection ids
  - Supabase Realtime Broadcast channel `propflow:project:<id>`, events
    `yjs-update` and `awareness`; updates are base64-encoded `Y.encodeStateAsUpdate`
  - updates received before DB hydration are buffered and replayed after load
- `src/App.tsx` — surgically rewired:
  - projects + library load from Supabase; `?share=<token>` resolves before load
  - read-only mode enforced for share links (`readOnlyRef` gates every mutation path)
  - remote Yjs changes reflect into React state; local React changes push into Yjs
  - canonical snapshot persisted to `project_documents` 1 s after last edit
  - redo added (`Ctrl/Cmd+Shift+Z`, `Ctrl+Y`); toolbar undo/redo buttons live
  - peer cursors + name flags + selection outlines rendered in the SVG
  - JSON import/export preserved; Share button writes to `share_links`

**Dependencies**: added `yjs@13`, `y-protocols`.

## Realtime model

Google Docs-like, per project: everyone with the same project open shares one live
document. Local edits broadcast over Supabase Realtime and merge via Yjs CRDT —
no locking, no last-writer-wins. A debounced canonical snapshot keeps
`project_documents` durable for fresh loads. Presence (cursor + selection) rides
the same channel via Yjs Awareness.

## Interim anonymous mode (IMPORTANT)

Until Touchstone/Petrock OIDC lands, the app runs in anonymous public mode:

- Anonymous RLS policies allow public read/write on `projects`, `project_documents`,
  `project_updates`, and read/update on `global_library`. **The database is publicly
  writable right now.** This is accepted temporarily and understood by Daniel.
- `share_links` anonymous access is intentionally narrow:
  - inserts allowed (link creation needs no identity yet)
  - reads go ONLY through the `resolve_share_token` RPC below — no direct anon
    SELECT on the table, so token hashes cannot be enumerated.
- `created_by` on imported rows is `null`; no owner memberships exist yet.
  Assign ownership after real authentication exists.

**When Petrock credentials arrive:**
1. Configure the Supabase custom OIDC provider (`custom:petrock`).
2. Backfill `project_members` ownership for the four imported projects.
3. Drop ALL anonymous policies (including the share-link insert policy).
4. Restrict the RPC or move share resolution behind auth.

## Dashboard SQL — run once in the Supabase SQL editor

```sql
-- Narrow anonymous share-link resolution (no direct table SELECT for anon)
create or replace function public.resolve_share_token(p_hash text)
returns table (project_id text)
language sql
security definer
set search_path = public
as $$
  select s.project_id
  from public.share_links s
  where s.token_hash = p_hash
    and s.expires_at > now()
$$;
revoke all on function public.resolve_share_token(text) from public;
grant execute on function public.resolve_share_token(text) to anon;

-- Interim: anonymous users may create share links (remove with Touchstone)
create policy "anon create share links (interim)"
  on public.share_links for insert to anon with check (true);
```

## Test checklist (manual, two tabs on `pnpm dev`)

- [ ] All four projects load from Supabase; library loads
- [ ] Create + rename + delete project persists across reload
- [ ] Two tabs: drag a node in tab A, it moves in tab B in real time
- [ ] Two tabs: cursors + selections visible with names
- [ ] Undo in tab A only undoes tab A's edits (never a peer's)
- [ ] Redo works (`Ctrl+Shift+Z`)
- [ ] Reload mid-edit: state recovered from `project_documents` snapshot
- [ ] Share link: `?share=<token>` opens read-only, mutations blocked, expires enforced
- [ ] JSON export downloads the current project
- [ ] Console shows no Supabase RLS 403s during normal use

## Rollback

- Pre-Phase 2 backups on the laptop: `src/App.pre-phase2.tsx`
- Git tag `pre-collab` on `main`; branch `phase-2-supabase-yjs` holds this work
- Committed Supabase schema: `~/workspace/goals/rocket-team-real-time-fluids-schematic-editor/schema.sql`
