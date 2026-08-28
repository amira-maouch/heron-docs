---
sidebar_position: 5
---

# How to Add a Component to the Registry

Components referenced in `metadata.json` (`shadcn:shadcn:button`,
`ui:display:avatar`, `egret-ui:core:sonner-provider`, ...) aren't bundled into
your app by default — they're served by Heron's component registries and
**vendored in** via `bundle-manifest.json`.

## Vendor a registry

```json
{
  "registries": {
    "egret-ui": "https://registry.heron.ws/api/registries/egret-ui"
  },
  "components": { "egret-ui": "*" },
  "services": { "egret-ui/core/egret-client": "*" }
}
```

- `registries` — which registries this app can pull from.
- `components` / `services` — which ones to actually vendor. `"*"` vendors
  everything in that namespace; you can instead list specific ids
  (`"ui/display/avatar": "*"`) to keep the build lean.

After adding an entry, rebuild — the resolved versions get written to
`.bundle-lock.json`, and the component becomes usable in any widget's
`metadata.json` by its `registry:namespace:type` id.

:::caution Coverage pitfall
No key in `bundle-manifest.json` may be an ancestor of another (e.g.
`"shadcn"` **and** `"shadcn/ui"` both present) — that's a build error, not a
merge. Pick one level of specificity per registry.
:::

## Finding what's already available

Check `.bundle-lock.json` at your app root — every key in it is a component
or service id you can already reference in `metadata.json` without adding
anything.

## Publishing a brand-new component

If you need a component that doesn't exist in any registry yet, it gets
authored and published in the **registry workspace** (a separate repo from
your app), not inside your consumer app. Each component there is a small
package with a `contract.json` (version, delivery type, target environments)
and a `src/index.tsx` entry — for example the registry's own `shadcn:button`
wrapper is just:

```tsx
// src/index.tsx
export { Button as default } from "@workspace/ui";
```

This is a platform-team workflow, not something most app builders need day to
day — if you find yourself reaching for it, talk to the platform team first.
