---
sidebar_position: 1
---

# Overview

Heron is the monorepo for the **egret/heron widget platform**: the server
composes JSON widget trees, and `page-engine` renders them as live React.
Widget scripts run as eval'd JS with `$egret` / `$self` handles. Because
widgets are JSON + scripts served by the app, most changes ship as **zero-code
deploys** — push widget JSON and scripts to the server, the app updates
without a release.

## Packages

| Package | Purpose |
|---|---|
| `page-engine` | Core renderer: Redux store, `DynamicComponent`, `StructuralContainer`, `ScriptLoader`, `PageRouter` |
| `page-engine-components` | Pre-registered built-in components (`egret:core:*`, `shadcn:*`, etc.) |
| `component-api` | `$egret` global runtime, event bus, deferred proxy, `getChild`/`listen`/`emit`/`setProps` |
| `component-registry` | Slot-based component factory registry with variant + platform/brand support |
| `app-runtime` | Web server: serves `/api/widgets`, `/api/scripts`, `/api/components`, `/api/translations` |
| `app-runtime-server` | Build scripts, middleware transformer, bundle-lock, platform query |
| `app-runtime-native` | React Native runtime: `NativeApp`, `NativeAppShellClient`, native API bridge |
| `i18n` | i18next wrapper, shared namespaces |
| `utils` | Shared build utilities |

## Data flow (end to end)

```
URL change → PageRouter → GET /api/widgets/:name
  → resolveMetadata (tags widget roots with _egretWidgetPackage)
  → runWidgetLoaders: for each root with dist-app/widgets/<w>/server.js
      loader(ctx) → result merged into node.props   ← server pre-fetch (no client waterfall)
  → MetadataTree JSON (with loader props baked in)
  → flattenTree → dispatch(setNodes) → React reconciles DynamicComponent tree
  → each leaf: mounts → emits component_ready → registerComponentReady in Redux
  → StructuralContainer: all children ready → emits own component_ready → ScriptLoader mounts
  → ScriptLoader: fetch /api/scripts/:widget → eval → widgetFunction($egret, $self)
  → widget script: $self.getProps() → already has loader data → skip fetch (or fallback)
  → widget script: getChild("@alias") → listen({ onClick }) → setProps() → emit()
```

## Key commands

```bash
# Build all packages (from heron root)
pnpm build

# Build a specific package
cd packages/page-engine && pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

See [Architecture](/docs/heron/architecture) for contracts, invariants, and
known pitfalls when working across packages.
