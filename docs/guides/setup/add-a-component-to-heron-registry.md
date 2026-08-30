---
sidebar_position: 2
---

# How to Add a Component to `heron_registry`

This is about **publishing** a new component so any app can vendor it — a
platform-level task, not something you do per consumer app. If you just want
to use an existing component, see
[How to Vendor a Registry Component](/docs/guides/setup/vendor-a-registry-component)
instead.

## Where it lives

`heron_registry` is a separate repo/workspace from your app and from the
`heron` framework monorepo. Components (and plugins, and services) are
discovered by a **plain filesystem convention** — no catalog file to update:

```
registries/<registry>/components/(<namespace>)/<name>/
├── contract.json
└── src/index.tsx
```

An Express server scans every `registries/<registry>/{components,plugins,services}/(<namespace>)/<name>/`
folder, esbuilds each `src/index.tsx` into a standalone IIFE bundle, and
serves it — adding a component is adding a folder, not registering it
anywhere.

Named registries you'll see: `shadcn` (thin wrappers over `@workspace/ui`),
`ui` (generic, app-agnostic), `egret-ui` (data-aware components + core
services like `egret-client`), plus per-app registries (e.g. `alefbab`) for
domain-specific components that don't belong in a shared one.

## Re-exporting an existing component

Most registry components are a one-line re-export of a real implementation
that already exists elsewhere (a design-system package, for instance) — the
registry artifact is a thin, stable pointer to it. Real example, the
registry's own `shadcn:button`:

```tsx
// registries/shadcn/components/(shadcn)/button/src/index.tsx
export { Button as default } from "@workspace/ui";
```

The registry doesn't own the component's implementation — it owns the
contract that lets Heron apps discover and load it.

## Writing `contract.json`

```json
{
  "contractVersion": "1.0.0",
  "artifactType": "component",
  "environment": ["universal"],
  "version": "1.0.0",
  "bundle": { "deliveryType": "source", "entry": "src/index.tsx" }
}
```

- `artifactType` — `"component"` here; a service uses the same shape under
  `services/` instead of `components/`.
- `environment` — `["universal"]` means it can run both server- and
  client-side. If your component genuinely can't render server-side, this is
  the flag that determines whether it's `renderMode`-compatible with SSR — see
  [Using SSR](/docs/guides/ssr/using-ssr).
- `version` — bump this when the component's contract (its props/behavior)
  changes in a way consuming apps need to know about.
- `bundle.entry` — the file that gets esbuilt into the served bundle.

## Figuring out its id

The id used in `metadata.json` (`"registry:namespace:type"`) comes directly
from the folder path — no separate registration step assigns it:

```
registries/<registry>/components/(<namespace>)/<name>/  →  "<registry>:<namespace>:<name>"
```

Real examples:
- `registries/shadcn/components/(shadcn)/button/` → `shadcn:shadcn:button`
- `registries/ui/components/(display)/avatar/` → `ui:display:avatar`
- `registries/egret-ui/services/(core)/egret-client/` → the service id
  `egret-ui/core/egret-client` (services are referenced by path, not the
  colon-separated component id — see [Services](/docs/guides/setup/services)).

If you can see the folder, you already know the id — there's nothing else to
look up.

## After publishing

The component isn't usable in any app until that app vendors it — add it to
the app's `bundle-manifest.json`. See
[How to Vendor a Registry Component](/docs/guides/setup/vendor-a-registry-component).
