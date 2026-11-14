# PropFlow: current architecture and handoff

Updated 2026-11-14. This supersedes the September 2026 Phase 2 implementation notes; Git history retains the original. Treat this as a starting point and inspect current code and deployment before relying on a behavior. The operating rules in [AGENTS.md](AGENTS.md) and Daniel's current instructions control.

## Project and workflow

PropFlow (P&ID Studio) is MIT Rocket Team's collaborative P&ID editor. Daniel Rojas owns product scope. The site is https://propflow.drojas.me. Work on `phase-2-supabase-yjs`, never main. Check status and recent commits before editing; build with `npm run build` before every commit; push to both `personal` (deployment source) and `mit` unless instructed otherwise, and verify the actual deployed flow. Other sessions work in parallel; preserve their changes and untracked files. Never commit credentials. Chat feature requests do not require separate plan approval. Do not start subagents without renewed permission.

## Architecture and persistence

The React/TypeScript/Vite application uses Supabase and Yjs. `src/App.tsx` coordinates the editor, diagram state, inventory, import/export and synchronization. `src/lib/db.ts` owns Supabase access; `src/lib/collab.ts` owns Yjs maps, merges and realtime synchronization. The Supabase project has projects, project_documents, project_updates, global_library and share_links. A project document contains the baseline diagram, SOP, project parts and optional test plans, sequences and failure analysis. Shared symbol definitions live in global_library. Its symbol overrides take precedence over stale project copies; do not alter symbolOverrides behavior without Daniel's express authorization.

The durable document includes canonical Yjs history in `_collab` alongside the JSON projection. Initial migration and writes use conditional revision checks; concurrent saves merge and retry. Local and peer updates are journaled in browser IndexedDB for recovery, and pending changes are not marked saved until acknowledged. Realtime uses the v2 project channel, with a timestamp watchdog and retry paths for missed updates. Portable JSON omits the internal history and imports initialize fresh history. See [collaboration persistence](docs/collaboration-persistence.md) for the migration, SQL guard, recovery limits and prior validation.

Nodes, edges and other entries are whole-entity values; concurrent edits to one entity can conflict. Test configurations are whole-entity collaboration entries, not fine-grained collaborative diagrams. Explicitly mark every edge attached to a deleted node as deleted. Sync and hydration prune dangling edges, but renderers must still tolerate them. Free-floating line stubs are legal. See [test planning review](docs/test-planning-review.md).

MIT sign-in uses Supabase custom provider `custom:petrock`. Read-only share links use an isolated anonymous resolver and enforce read-only UI. RLS is deliberately disabled on the listed tables in the current interim configuration; do not enable it or change grants without Daniel's authorization. Do not execute the old September setup SQL from Git history as a current deployment recipe. Check actual infrastructure before making access claims.

## Product model

- The top-level diagram is the baseline. Test configurations contain independent diagram snapshots and multiple SOP sequences; active test and sequence are browser-local. The first baseline sequence is mirrored into legacy `sop`.
- Failure events are project-shared; AND/OR trees refer to event IDs and can be scoped to tests, sequences and steps. The scenario preview is Boolean and local, not a quantitative reliability or hardware simulation.
- SOP playback supports cumulative actions and qualitative pressure and fluid previews, plus WebM and GIF export. These are not a drain-time or full physical model.
- The pressure ladder is a route-based exploratory analysis, not a simultaneous network solver. It uses persisted line dimensions, bounded nitrogen properties and ideal regulator setpoints; dome supply, regulator droop and two-phase flow are not solved. See [pressure ladder model](docs/pressure-ladder-model.md) for assumptions and bounds.
- Inventory parts are stored per project and may be linked to diagram components and physical line assembly items. The BOM counts explicitly listed assembly items; a line with only an adapter listed implies one adapter, not an additional tube. The assembly row can create and link a new inventory part. The adapter currently suppresses direct end-to-end mismatch warnings; its own two interfaces are not independently validated.
- The part editor uses the shared `uid()` helper for part, specification and link IDs, including in non-secure browser contexts where `crypto.randomUUID()` may not exist.
- A junction directly adjacent to a regulator can be designated a built-in pressure port without changing the schematic. The regulator's inventory part can record left/right gauge-port fittings separately from process-port fittings. Directly attached sensor fitting comparisons are preliminary; they do not prove a physical assembly is compatible.
- Dome-loaded regulator simulation was previously left incomplete. A library symbol by itself does not demonstrate isolated dome-supply behavior; inspect current flow and SOP logic before extending it.
- Custom symbols and behaviors are shared through the library. See [custom symbol behavior](docs/custom-symbol-behavior.md). Selecting a component reopens its inspector; renaming labels is inline. Do not create a vehicle quick-disconnect feature without Daniel's go-ahead.

## Portable files and exports

Project JSON format v2 validates IDs, coordinates, SOP structure and dangling edges. Landing import creates a copy. Editor import appends new test configurations and remaps references; it never replaces existing diagrams or imports symbol overrides over shared overrides. `local-` projects are session-only and Save downloads a backup. PNG/PDF export bounds include symbols, pipe routes and shape endpoints; the key is positioned relative to the crop. See `src/projectImport.ts` and the export code in `src/App.tsx`.

## Main code locations

`src/Landing.tsx` handles the landing page; `src/SopWorkspace.tsx` the SOP editor; `src/PressureAnalysis.tsx` and `src/pressureModel.ts` the ladder; `src/ProjectControls.tsx`, `src/projectPlanning.ts` and `src/testModel.ts` planning; `src/FailureWorkspace.tsx` failure trees; `src/components/PartDialog.tsx` and `src/components/BOMView.tsx` inventory and BOM; `src/lib/fittingCompatibility.ts` preliminary fitting warnings; and `src/SymbolWorkshop.tsx` symbol editing.

## Verification and handoff

Run the applicable scripts in `scripts/` and the production build. For deployment verify ASTERIA and ASTERIA-RCS render; use disposable project copies for component deletion/reload, export PNG/PDF, and JSON download/reimport. Do not claim that a build or push is live verification. Recent commits `484705e` and `35deb0a` introduced regulator gauge-port metadata and line inventory creation; their full live export/import/deletion regression was not completed in those turns. Consult [AGENTS.md](AGENTS.md) for the complete current checklist and invariants.

To hand off to another account, provide this file, AGENTS.md and relevant docs, plus repository/service access separately. Do not include secrets in the handoff.
