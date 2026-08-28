---
sidebar_position: 2
---

# Architecture

## Find it fast

| Looking for... | Go to |
|---|---|
| Widget tree → flat Redux map | `page-engine/src/utils/flattenTree.ts` |
| Component type → React component resolution | `page-engine/src/registry/ComponentRegistry.ts` |
| All pre-registered built-in components | `page-engine-components/src/UIComponents.ts` |
| `component_ready` emission (leaf) | `page-engine/src/core/components/LeafComponent.tsx` |
| `component_ready` emission (structural/widget) | `page-engine/src/core/components/StructualContainer.tsx` (typo in filename) |
| Redux store actions | `page-engine/src/store/slice.ts` |
| EventBus → Redux bridge | `page-engine/src/store/eventBusBridge.ts` |
| Script fetch + eval | `page-engine/src/components/ScriptLoader.tsx` |
| `$egret` instance construction | `component-api/src/ComponentRuntime.ts` |
| `$egret.auth` / authorization guide | `docs/authorization.md` · `component-api/src/auth/` |
| HTTP API server entry | `app-runtime/server/dev-api.ts` (dev) / `server/prod-server.ts` (prod) |
| Route → widget folder mapping | `app-runtime/app/core/utils/loadAppManifest.ts` |
| Widget tree recursive assembly | `app-runtime/app/core/utils/resolveMetadata.ts` |
| Component bundle lock file | `.bundle-lock.json` (project root of host app) |
| Server-side widget loaders (type + builder) | `app-runtime-server/server/widgetServerContext.ts` |
| Server-side loader orchestrator | `app-runtime-server/server/runWidgetLoaders.ts` |

## Contracts

- Component field in metadata: `"registry:namespace:type"` — exactly 3 colon
  parts. `flattenTree` throws otherwise.
- Every `component_ready` emitter must use its **full dot-path** as
  `componentId`. Mismatch silently stalls `pageReady`.
- Widget scripts must eval to `function($egret, $self) { ... }`. Any other
  shape throws at `ScriptLoader`.
- `componentRegistry` is a `globalThis` singleton — all packages must share
  the same instance.
- Built-in components registered in `UIComponents.ts` use `type: "leaf"` or
  `"structural"`. `"structural"` nodes wait for all children before emitting
  `component_ready`; `"leaf"` nodes emit on mount.

## Known pitfalls

### StructuralContainer filename typo
File is `StructualContainer.tsx` (missing "r"). Export is
`StructuralContainer`. Do not rename the file — it will break the import in
`DynamicComponent.tsx:23`.

### `isReady` is a one-way latch; re-emit uses navigationSeq
`StructuralContainer.isReady` never reverts to false (prevents ScriptLoader
unmount). But after `resetPageReady()` clears `readyComponentIds`, children
must re-emit `component_ready` on the new `navigationSeq`. Uses
`lastEmittedSeqRef` to detect when to re-emit without resetting `isReady`.

### `state.nodes` diverges from `flattenTree` output
`updateComponentProps` mutates live `state.nodes`. Never diff `state.nodes`
against fresh `flattenTree` output — `PageRouter` diffs against
`prevStaticNodesRef` (last `flattenTree` output).

### `resolving` state renders `null` silently
While `componentRegistry.resolve()` is in flight, `ComponentRenderer` returns
`null` with no loading UI. If a resolver hangs, the subtree is invisible with
no error.

### `.bundle-lock.json` read on every request
No caching — cold file read per `/api/components` or `/api/services` request
in the server.

## Per-package AGENTS.md

Each package below has its own deeper reference:

| Package | Doc |
|---|---|
| page-engine | `packages/page-engine/AGENTS.md` |
| component-api | `packages/component-api/AGENTS.md` |
| component-registry | `packages/component-registry/AGENTS.md` |
| app-runtime | `packages/app-runtime/AGENTS.md` |
| app-runtime-server | `packages/app-runtime-server/AGENTS.md` |
| app-runtime-native | `packages/app-runtime-native/AGENTS.md` |
