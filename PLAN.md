# PLAN: De-leak Architecture

This plan fixes the leaky abstractions identified:
- graph relationships duplicated in nodes + edges
- DB artifacts (table/view SQL/types) baked into domain nodes
- UI building SQL and querying DuckDB directly
- persistence/export mixing platform-specific file ops
- session format mixing pipeline + UI layout + runtime artifacts
- stores reading window/document directly

The goal is to separate: **domain model**, **runtime artifacts**, **UI state**, and **platform IO**.

---

## Status update (2026-01-24)
Work completed so far:
- Added runtime/layout separation:
  - New types: `src/types/pipelineRuntime.ts`, `src/types/pipelineLayout.ts`.
  - New stores: `src/stores/pipelineRuntimeStore.ts`, `src/stores/pipelineLayoutStore.ts`.
  - Hydration layer: `src/lib/pipeline/hydration.ts`, `src/lib/pipeline/hooks/useHydratedNodes.ts`.
- Removed runtime/layout fields from domain types:
  - `src/types/pipeline.ts` removed `parentId/parentIds`, `tableName`, `columns`, `rowCount`, `position`, `isExpanded`, `viewSql`, `outputTableName`, `matplotlibOutput`, `executionTimeMs`, `lastExecutedAt`, `dimensions`.
  - `src/types/dataset.ts` removed `duckdbType` from `Column`.
- Pipeline store updated to manage domain + runtime + layout separately:
  - `src/stores/pipelineStore.ts` now consumes runtime/layout on add, removes on delete, updates edges via new `setNodeParents`.
  - `src/stores/index.ts` exports new stores.
- Engine/graph updates:
  - `src/lib/core/engine/types.ts` and `PipelineEngine.ts` now update edges only and use `parentIds`.
  - `src/lib/graph/dag-operations.ts` now uses edges via `getParents`.
- DuckDB + view manager updates:
  - `src/lib/duckdb/interface.ts` now returns `RuntimeColumn[]`.
  - `src/lib/duckdb/wasm-client.ts` and `src/lib/duckdb/tauri-client.ts` updated.
  - `src/lib/duckdb/view-manager.ts` now returns runtime artifacts separately (`ViewCreationResult`, `ViewUpdateResult`).
  - `src/lib/pipeline/PipelineService.ts` updated signatures and runtime handling.
- Major hook/component migrations (partial):
  - `src/lib/pipeline/hooks/useViewOperations.ts` updated to use runtime/layout stores.
  - `src/lib/pipeline/hooks/useDatasets.ts` updated to use runtime/layout stores.
  - `src/lib/pipeline/hooks/usePipeline.ts` now returns hydrated nodes.
  - `src/lib/data-grid/useCellCommit.ts`, `src/lib/data-grid/DataGrid.tsx`, `src/components/PipelineCanvas.tsx` updated to use hydrated/runtime data.
- `src/lib/operations/ui.ts` updated to use edges for parent lookup.

In progress / remaining work:
- Phase 1 (edges as source of truth):
  - Finish updating remaining call sites that still read `parentId/parentIds` from nodes.
  - Add/confirm graph selector utilities if needed (or standardize on existing `dag-operations` helpers).
  - Legacy session migration (convert `parentId/parentIds` into edges) still pending.
- Phase 2 (runtime/layout separation):
  - Update remaining components/hooks using `tableName`, `columns`, `rowCount`, `position`, `viewSql` directly on nodes.
  - Update `useUndoRedo` + snapshot types to include runtime/layout.
  - Update `PipelineService.restoreSession` and persistence to load runtime/layout separately.
  - Fix any type errors + run Biome formatting (current `pipelineStore.ts` formatting is messy).
- Phase 3 (QueryService):
  - Create `QueryService` and migrate SQL-building from UI dialogs/panels.
- Phase 4 (file system adapter):
  - Create adapter and migrate `persistence.ts`, `exporter.ts`, and file pickers.
- Phase 5 (session format split):
  - Implement `pipeline.json`, `layout.json`, `runtime.json` serialization + back-compat.
- Phase 6 (no window/document in stores):
  - Move DOM-related logic out of stores (e.g. `panelStore.ts`).
- Phase 7 (validation):
  - Lint, typecheck, and manual end-to-end verification.

---

## Phase 0: Preparation and safety
1. Add a migration/compat layer so old sessions still load.
2. Ensure we have a full list of call sites that touch:
  - `parentId/parentIds`, `edges`
   - `tableName`, `viewSql`, `duckdbType`, `outputTableName`
   - SQL string building in UI
   - direct `window`/`document`/DOM usage in stores
   - direct Tauri/Web file operations
3. Keep changes incremental: introduce new abstractions, then migrate call sites.

---

## Phase 1: Make graph relationships single-source-of-truth
**Decision:** edges become the only source of parent/child relationships. Nodes no longer store `parentId`/`parentIds`.

Steps:
1. Introduce a graph selector module (e.g. `src/lib/graph/selectors.ts`) that can:
   - `getParentIds(nodeId, edges)`
   - `getChildIds(nodeId, edges)`
   - `getRootIds(nodes, edges)`
2. Update node types:
   - Remove `parentId`/`parentIds` from `DataView`, `ChartNode`, `ExportNode`, `DashboardNode`, `PythonNode`.
   - Any UI needing parents uses selectors.
3. Update pipeline engine and store:
   - Engine commands should update edges only.
   - Remove any logic that also mutates parentId(s).
4. Update all usages:
   - Replace `node.parentId`/`node.parentIds` reads with selectors.
   - Replace any persisted parentId(s) with edges.
5. Migrate legacy sessions:
   - On load, if `parentId/parentIds` are present, convert them to edges and drop the fields.

Risks: large call-site churn; ensure no view/query logic expects parentId(s).

---

## Phase 2: Separate domain nodes from DB/runtime artifacts
**Goal:** domain nodes should not contain DB-specific fields.

Steps:
1. Create new runtime metadata structure, e.g.:
   - `PipelineRuntimeState` mapping `nodeId -> { tableName, viewSql, outputTableName, duckdbTypes, rowCount }`
2. Update types:
   - Remove `tableName`, `viewSql`, `duckdbType`, `outputTableName` from domain node types.
   - Add a runtime API to fetch these artifacts by `nodeId`.
3. Update pipeline services:
   - `PipelineService` and `view-manager` produce/update runtime artifacts instead of writing into node objects.
4. Update call sites:
   - Anything using `node.tableName`/`node.viewSql` reads from runtime state or service.
5. Serialization:
   - Persist runtime artifacts separately from domain nodes (see Phase 5).

Risks: view recreation + undo/redo must reference runtime artifacts correctly.

---

## Phase 3: Centralize SQL building + DuckDB access
**Goal:** UI stops building SQL strings or hitting DuckDB directly.

Steps:
1. Create a `QueryService` (e.g. `src/lib/duckdb/query-service.ts`) with methods such as:
   - `previewJoin`, `previewUnion`, `previewFilter`, `previewPivot`, `previewDistinctValues`, `sampleRows`, `countRows`.
2. Move SQL building from UI into service:
   - Join/Union/Pivot dialogs
   - Filter editor
   - SQL panel preview logic
   - Dashboard distinct value fetch
3. Ensure UI only calls the service and consumes results.

Risks: keep QueryService API minimal and reusable; avoid reintroducing raw SQL in UI.

---

## Phase 4: File system + persistence platform abstraction
**Goal:** no module mixes Tauri file APIs and DOM download logic.

Steps:
1. Create `fileSystem` adapter in `src/lib/runtime` or `src/lib/file-system`:
   - `saveFile({ suggestedName, data, extensions })`
   - `openFile({ extensions })`
   - runtime picks Tauri vs web.
2. Update `persistence.ts`, `exporter.ts`, and any file pickers to use this adapter.
3. Remove direct `saveFileTauri` usage outside the adapter.

---

## Phase 5: Session format split
**Goal:** keep pipeline model independent from UI layout and DB artifacts.

Steps:
1. Split session payload into:
   - `pipeline.json` (domain nodes + edges)
   - `layout.json` (positions, UI state)
   - `runtime.json` (DB artifacts: viewSql, table names, duckdb types)
2. Update serialization/deserialization to read/write these separately.
3. Backwards compatibility:
   - If legacy session includes `viewSql` or UI-only fields, map them to runtime/layout during load.
4. Update cloud sync (if applicable) to only sync domain data; keep runtime/layout local.

---

## Phase 6: Remove window/document usage from stores
**Goal:** stores are pure state; DOM is accessed in hooks/components.

Steps:
1. Identify store logic that uses `window`/`document` (e.g. `panelStore.ts`).
2. Move that logic into UI hooks/components:
   - For example, compute `sqlPanelHeight` bounds in a hook and dispatch a safe value into the store.
3. Ensure stores are SSR-safe (no direct window/document usage).

---

## Phase 7: Validation + clean-up
1. Run `bun run lint -- --write`.
2. Run `bun run typecheck` (or the project’s TS check command).
3. Run relevant tests (unit or integration if present).
4. Manually verify:
   - Create dataset -> view -> chart -> export
   - Undo/redo
   - Save/load session
   - SQL panel + preview dialogs
   - Tauri and web save flows

---

## Notes on sequencing
- Phases 1 + 2 are the most invasive; do them first so all downstream logic uses the new boundaries.
- Phase 3 can proceed in parallel after runtime artifacts exist.
- Phase 4/5 can be done once runtime and domain separation is in place.
- Phase 6 is a small cleanup after the major refactors.

---

## Rollback strategy
- Each phase should be a distinct commit to isolate risks.
- Keep a compatibility adapter for old sessions until a migration window is acceptable.
