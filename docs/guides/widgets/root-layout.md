---
sidebar_position: 3
title: The Root Layout
---

# The Root Layout

Every Heron app has one special widget, `widgets/root/`, that wraps **every
single route** — before any per-route `layout`, before the page itself. It's
what stabilizes the app: the providers it holds mount once and never remount
as you navigate, so app-wide state (toasts, dialogs, the active language)
survives route changes instead of resetting.

This is different from a regular [layout](/docs/guides/widgets/how-to-add-a-layout) —
you don't choose to use the root widget, and you don't reference it from
`app-manifest.json`. It's always there.

## What it holds

Provider-style components: a toast host, a dialog host, the i18n provider —
anything that needs to exist exactly once, above everything else. Real
example, `alefbab_app`'s `widgets/root/metadata.json`:

```json
{
  "component": "egret:core:layout",
  "id": "app-root",
  "children": [
    {
      "component": "egret-ui:core:sonner-provider",
      "id": "app-toaster",
      "props": { "position": "top-right", "richColors": true, "closeButton": true }
    },
    { "component": "ui:overlay:dialog-provider", "id": "app-dialog" },
    {
      "component": "ui:layout:i18n-provider",
      "id": "language-provider",
      "children": [
        {
          "component": "egret:core:app-provider",
          "id": "app-provider",
          "props": { "marker": false },
          "children": [
            { "component": "egret:core:slot", "id": "page-outlet" }
          ]
        }
      ]
    }
  ]
}
```

The one node that matters structurally is `egret:core:slot` (`page-outlet`)
at the bottom — that's where the matched route (and its `layout`, if any)
actually renders. Everything above it in the tree is app-wide chrome/state
that wraps the whole app exactly once.

## `script.ts` (optional)

Use it for one-time app-boot work — real example, `alefbab_app`'s
`widgets/root/script.ts`:

```ts
const EXTRA_NAMESPACES = ["components", "validation", "errors"];

const rootScript = ($egret: EgretRuntime) => {
  void $egret.i18n.loadNamespaces(EXTRA_NAMESPACES).catch(() => {
    // Non-fatal: components fall back to their defaultValue / raw key.
  });
};

export default rootScript;
```

`script.ts` is genuinely optional here — `bootstrap_app`'s root widget has a
`metadata.json` but no `script.ts` at all. Only add one if you have real boot
work to do (preloading i18n namespaces, initializing something global).

## How to create/customize it

`widgets/root/metadata.json` is created for you when an app is scaffolded —
you're editing an existing file, not creating this widget from scratch. To
add something app-wide (a new global provider, an analytics init, a feature
flag gate), add it as a new child in `widgets/root/metadata.json`, wrapping
(or wrapped by) the existing `page-outlet` slot depending on whether it needs
to be outside or inside the providers already there.

:::caution Don't put page-specific UI here
Anything route-specific belongs in a page widget or a [layout](/docs/guides/widgets/how-to-add-a-layout),
not root. Root renders on every single page, including ones a `layout`
wouldn't otherwise touch (error pages, auth pages) — keep it to things that
truly are global.
:::

## Theme

The active color theme (`app-manifest.json`'s `"theme"` field, e.g. `"sky"`)
applies globally through the same app-wide mounting — not something you wire
in root's metadata directly. See [App Structure § `themes/`](/docs/heron/app-structure#themes).

## Next

Now that you know what always wraps every page, [How to Add a Layout](/docs/guides/widgets/how-to-add-a-layout)
covers the layer you *do* choose per-route.
