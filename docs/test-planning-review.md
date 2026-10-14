# Test planning and failure analysis: first review pass

A project now holds a baseline P&ID and named test configurations. A cold-flow, hot-fire, hover, or custom configuration starts as a copy of the current diagram and SOPs. Its diagram and procedures can then diverge independently. Choosing a configuration or sequence affects only the current browser.

## Review the workflow

1. Rename a project from its landing card or the editor context bar. Its project ID and share links stay stable.
2. Add a test configuration and edit its P&ID. Switch back to Baseline to check that the original diagram is intact.
3. Add multiple SOP sequences to that configuration, starting empty or copying the selected SOP. The selected sequence drives both SOP playback and the pressure ladder.
4. Use Ctrl/Cmd+F or Ctrl/Cmd+K to find a placed component by tag, type, or fluid. Enter selects it, centers the canvas, and opens the inspector. The sidebar search still filters the parts library.
5. Import JSON inside the editor and choose **Add to this project**. Every imported diagram becomes a new test configuration. Component, pipe, shape, procedure, part, symbol, and failure-event identities are remapped; existing configurations are preserved. The project's existing shared symbol overrides remain authoritative. Landing imports continue to create separate copies.
6. Open **Failure analysis**, create a top event, choose OR or AND, and add causes. Use **Link existing cause** to reuse a shared event or subtree. Renaming an event or editing its detection/response updates every tree referencing it.
7. Trees initially apply to every test and SOP step. Link a test, sequence, or step to narrow applicability. The SOP sidebar shows applicable trees, and the analysis page lists the number of linked trees for each step. These counts describe links, not the completeness of the analysis.
8. Check **Assume this event occurred** on basic events to exercise the tree logic. Incomplete gates are identified. Scenario assumptions are temporary and are not saved.

## Storage and collaboration

Existing project `nodes`, `edges`, `shapes`, `canvasSize`, and `sop` remain the baseline. Optional `sequences`, `testPlans`, `failureAnalysis`, and `projectName` fields are included in server persistence and format-v2 JSON backups. The baseline's first sequence is mirrored into the legacy `sop` field.

Test configurations, baseline sequences, failure events, and failure trees each occupy separate Yjs map entries. Failures are stored once in the event library, and gates refer to their causes by ID. Cycles are prevented in the editor and rejected by the importer. Repeated subtrees appear as shared references instead of expanding indefinitely.

An individual test configuration is currently one collaboration entity. Concurrent edits to different configurations or failure events merge independently; simultaneous edits inside the same configuration use the existing whole-entity conflict behavior. Fine-grained collaboration within test diagrams is a follow-up. Refresh teammates to the new build before editing the new fields: older clients do not preserve these extensions when saving a full document.

Deleting a test or sequence retains its scoped failure links as visibly missing references, so removal does not silently broaden a tree to all contexts. Deleting a tree leaves its reusable events in the library. Referenced events cannot be deleted until their uses are unlinked. Editor undo covers the new collections.

## Failure-analysis boundary and next steps

This pass is an authoring tool with Boolean AND/OR scenario evaluation. It does not infer component failure modes, simulate failed hardware through the fluid network, compute probabilities, assume independence, or produce minimal cut sets.

The next useful additions are component-level failure-mode templates, a searchable event-to-tree/step usage view, configuration comparisons, and explicit coverage review. After those are reviewed, the model can connect commanded SOP states to failed component states and calculate cut sets while preserving common-cause dependencies. Quantitative analysis should follow a defined source/evidence model for each probability.

## Verification

- `npm run build` passes.
- `node scripts/check-planning.mjs` (Node 24+) verifies configuration/sequence isolation, Boolean logic, applicability, cycle rejection, nested import validation, identity/reference remapping, Yjs round trips, stale-peer protection, deletion/undo, and dangling-edge pruning with legal stubs preserved.
- Browser checks exercised project-card download/import, editor import into an existing project, independent configuration edits, component search, multiple SOPs, shared failure events, step scopes, and server save/reload in a throwaway ASTERIA copy.
- Actual ASTERIA and ASTERIA-RCS rendering, PNG/PDF export, and deployment verification are recorded in the completion message. A certificate mismatch at the custom domain is a separate live-browser verification boundary if still present.
