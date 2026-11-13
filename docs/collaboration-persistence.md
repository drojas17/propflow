# Collaboration persistence — 2026-11-12

## Problem and repair

The previous editor rebuilt a separate Yjs history from JSON in every browser.
A late peer's older initialization could win over a live edit during the
full-state handshake. Persistence separately checked the server timestamp and
then unconditionally replaced the snapshot, so simultaneous saves could discard
unrelated edits. Save completions also marked newer, unacknowledged edits saved.

`project_documents.doc._collab` now stores the canonical encoded Yjs history
alongside the existing JSON projection. A conditional migration initializes a
legacy project only once; simultaneous openers reload the winning history.
Existing port/library normalization is applied before that first history is
exposed to editors. Library symbol-override precedence is unchanged.

Every save reads JSON and revision in one request, merges the stored history,
then conditionally updates the row against that exact revision. Lost races
reload, merge and retry. Each editor has one save in flight; edits during a
request remain dirty and drain before manual Save/project navigation completes.
Read failures and timeouts cannot fall through to a replacement write.

Browser IndexedDB journals incremental local and received peer edits, including
the dependencies needed to replay subsequent local changes. Reopening the project
replays pending updates onto the stored history. Only records included in an
acknowledged save are cleared; one tab cannot clear another tab's new edits.
Storage errors are logged and network retries continue. This is browser-local
recovery, not a cross-device offline store; editing still requires an initial
successful project load.

Failed autosaves retry. Visibility/focus/online changes trigger a save or
refresh, and a 15-second watchdog checks a small timestamp response before
fetching a changed document. This recovers missed realtime/Postgres messages
without repeatedly downloading unchanged diagrams. Failed loads show Retry
loading; failed saves show Save failed — retrying. Browser unload warns about
pending edits. Share and OAuth navigation stop if saving fails. Creating a
project cannot overwrite an existing project document. Inventory part deletion
now records an explicit deletion, matching other collaborative entities.

## Compatibility and deployment

New editors use the `propflow:v2:project:<id>` broadcast topic. Old independently
seeded Yjs documents must never be merged into the canonical history.

[The SQL guard](sql/2026-11-12-canonical-collaboration.sql) was applied to the
live Supabase project and tested on a disposable project. Once a row contains
canonical history, pre-upgrade saves that would remove it are rejected. No
project contents, RLS policies or grants are rewritten by this migration.
Already-open old editors must download JSON if they have pending work, then
refresh. The guard's rollback commands are included in the SQL file if reverting
the frontend to a pre-canonical release.

Portable version-2 project JSON intentionally excludes `_collab`. Imports create
fresh history and preserve the source project. The existing JSON shape and
read-only share-link format remain compatible.

Signed-in viewers also hit a separate existing bug: `resolve_share_token` is
granted to the anonymous role, but the editor called it with its authenticated
session and received HTTP 403. Token resolution now uses an isolated anonymous
client without session persistence, token refresh or URL-session detection.
Database grants are unchanged. Read-only views show Read-only, hide Save and
editing tools, and disable inspector/library editing instead of allowing
temporary changes that could never be persisted.

## Validation

- `node scripts/check-project-persistence.mjs`: simultaneous migration, late
  joins with stale snapshots, concurrent saves without broadcasts, fresh reload,
  one request in flight, edits during saves, failed reads, hung requests, delete
  versus edit, legal pipe stubs, local undo and portable copies.
- Existing collaboration, planning/import, custom-library and export-key checks.
- `node scripts/check-share-links.mjs`: signed-in callers use anonymous-only
  resolution without inheriting their editor session; invalid/expired tokens,
  hashing and resolver errors retain their previous behavior.
- Production TypeScript/Vite build.
- Live Supabase: simultaneous migration plus five concurrent save/reload rounds
  on `zzz-sharing-20261112-race`; all edits retained, six conflicts safely retried.
- Live database guard: simulated legacy update rejected; both content and
  revision unchanged.
- Browser checks use disposable ASTERIA copies. Two local-browser editors saved
  different components; a failed-save edit was restored after reload.
- Deployed two-tab edits retained both component changes; deleting a tank with
  four connected pipes survived reload with no dangling pipes. ASTERIA and
  ASTERIA-RCS rendered. PNG and PDF exports contained the full diagram and key.
  Landing-card JSON download/import opened an independent copy with fresh
  history and left the original document unchanged.

## Remaining limits

Baseline nodes/edges are whole-entity values. Concurrent edits to different
fields of the same entity still resolve to one value. Each test configuration
is also a whole entity; this patch does not provide fine-grained simultaneous
editing inside the same test diagram. Presence still lacks test/sequence scope.
There is no measured cross-computer or long-duration latency guarantee.
