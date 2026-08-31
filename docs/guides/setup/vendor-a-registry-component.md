---
sidebar_position: 1
---

# How to Vendor a Registry Component

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

:::caution[Coverage pitfall]

No key in `bundle-manifest.json` may be an ancestor of another (e.g.
`"shadcn"` **and** `"shadcn/ui"` both present) — that's a build error, not a
merge. Pick one level of specificity per registry.

:::

## Finding what's already available

Check `.bundle-lock.json` at your app root — every key in it is a component
or service id you can already reference in `metadata.json` without adding
anything.

## Need a component that doesn't exist yet?

That's authored and published in `heron_registry` — a separate,
platform-level workspace, not something you do inside your app. See
[How to Add a Component to `heron_registry`](/docs/guides/setup/add-a-component-to-heron-registry).
