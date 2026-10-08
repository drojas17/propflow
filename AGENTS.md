# PropFlow — operating manual for coding agents

PropFlow (P&ID Studio) is the MIT Rocket Team's real-time collaborative P&ID editor.
Live site: https://propflow.drojas.me — Daniel Rojas (drojas17) is the owner; his word wins on scope.

## Repo rules (hard)

- Work on branch `phase-2-supabase-yjs`. NEVER touch `main`.
- Remotes: `personal` = git@github.com:drojas17/propflow.git (deploy source), `mit` = https://github.mit.edu/Liquid-Propulsion-Controls/Prop-flow.git.
- Push to both `personal` and `mit` by default, unless Daniel explicitly requests otherwise.
- Run `git status` and `git log --oneline -5` before editing: other agents (Kev, other Codex sessions) edit this repo in parallel and may have committed. Don't clobber their work.
- Build before every commit: `npm run build` (tsc -b && vite build) must pass.
- A change is not done until it's built, pushed to both personal and mit, and verified on the live site through the path Daniel actually uses.
- Stay inside this project folder. Don't delete untracked files (e.g. build_push_tmp.ps1, *.bat helpers) without asking.
- Never expose or commit secrets (Supabase keys, MIT OAuth credentials).
- Never change `symbolOverrides` behavior without Daniel's explicit say-so.
- Features from user feedback are implemented only after Daniel approves a plan. Bug fixes are fine.

## Code map

- `src/App.tsx` — the editor: canvas, nodes/edges/shapes, SOP editor, pressure ladder, PNG/PDF export, JSON import/export, Training Lab.
- `src/Landing.tsx` + `src/landing.css` — entry page: project list, Import JSON, per-card JSON download, sign-in.
- `src/Tutorial.tsx` — tutorial/tour page.
- `src/lib/collab.ts` — Yjs document sync: projectToDoc/docToProject, pushStateToDoc, mergeRemoteProject, pruneDanglingEdges.
- `src/lib/db.ts` — Supabase REST calls: ensureProject, loadProjectDoc, saveProjectDoc, loadLibrary, listProjects.
- `src/lib/supabase.ts` — client. Supabase project: xqnpqsckcrbckdaozquc.
- `PHASE2_NOTES.md` — phase-2 architecture notes.

## Data model

- Supabase tables: projects, project_documents (one JSON doc per project), project_updates, global_library, share_links.
- Load path: ensureProject() → loadProjectDoc() + loadLibrary() in parallel → hydrate() → Yjs projectToDoc. Autosave ~1s debounce; remote docs merge via mergeRemoteProject.
- Project doc keys: nodes, edges, shapes, canvasSize, sop, parts, customSymbols, symbolOverrides, projectName.
- MIT sign-in is a custom OAuth provider (custom:petrock) via Supabase Auth.
- RLS is currently DISABLED on the tables (deliberate interim state; table-level grants are already set). Do not re-enable RLS or change grants without Daniel's say-so — that happens later, when server editing becomes MIT-login-only.
- The library (global_library) holds shared symbol definitions; at load, the library's symbolOverrides beat any stale copy in a project doc.

## Collaboration invariants (learned the hard way)

- Deleting a node must mark EVERY connected edge as explicitly deleted (`edge:<id>` in explicitlyDeletedRef). Deleting only the node lets pipes resurrect from the shared doc after refresh/undo ("phantom lines converging at the top-left" — edgeRoute used to fall back to {x:0,y:0} for missing endpoints).
- pushStateToDoc() and mergeRemoteProject() prune edges whose endpoints are missing (pruneDanglingEdges). hydrate() also drops dangling edges on load.
- Renderers must tolerate dangling edges anyway: edgeRoute() returns [] and pointsPath() returns '' for a missing endpoint. Never draw an edge to (0,0).
- Free-floating pipe stubs (no from/to, explicit endpoints) are legal and must be preserved.
- Merging is whole-entity last-writer-wins per node/edge; remote sync clears the local selection (known quirk).

## Product rules Daniel has set

- Label renaming is an inline canvas input, never a browser prompt/dialog.
- Selecting a component reopens its details panel.
- Hitboxes and selection outlines must fully contain each symbol (see nodeVisualBounds, +8px pad) without swallowing neighbors or dead canvas.
- Shift-drag alignment snaps to the dragged component's own connected ports and its straight-run pipes, not node centers.
- No vehicle quick-disconnect ("disconnect") component exists yet — it's a proposed feature; don't build it without Daniel's go-ahead.

## JSON import/export (format v2)

- Files: {format:"propflow-project", version:2, exportedAt, projectName, nodes, edges, shapes, canvasSize, sop, parts, customSymbols, symbolOverrides}.
- Export embeds only the custom symbols and override keys actually used by the diagram's nodes.
- Import NEVER overwrites: it always creates a copy (server project when signed in; local-only otherwise), auto-renaming on collision (name-imported, -2, ...).
- The validator normalizes and drops dangling edges with a warning count; it rejects format mismatches, versions >2, duplicate ids, non-finite coords, and malformed SOP.
- IDs starting with `local-` are session-only (in-memory registry; refresh discards; Save downloads a JSON backup). `local` and `tour-local` are reserved. Never seed an import into the currently open collaborative doc — open it as a new project.

## Export (PNG/PDF)

- exportCanvas() bounds must include node bounds, every edgeRoute point (waypoints/bends/stub ends), and shape endpoints — or pipes get cropped.
- The legend/key band is drawn relative to cropX with width cropW; the PDF page is [cropW, totalH] and the image is placed at 0,0 at those exact dims.

## Verify before claiming done

Live site, real flows: open ASTERIA and ASTERIA-RCS (both must render), delete a component with pipes and reload (nothing may reappear or point at the top-left), export PNG+PDF (full diagram + legend), download a project JSON from a landing card and re-import it (must open as a copy; original untouched), Landing Import JSON and editor Download JSON buttons present. Use throwaway projects (e.g. zzz-test) cloned from a real one for destructive tests, and delete them afterwards.
