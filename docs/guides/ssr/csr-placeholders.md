---
sidebar_position: 2
title: Client Boundaries and Widget Placeholders
---

# Client Boundaries and Widget Placeholders

Some components and widgets cannot render on the server—a map, a canvas
editor, or anything that needs `window`. Heron treats each one as a stable
client boundary. The boundary owns its bundle loading; an ancestor widget
does not blank its already-visible SSR content while that bundle downloads.

The same authored widget placeholder is also loading UI on a CSR web or
mobile page. It remains visible while that widget's bundles, declared
translations, and platform styles become ready, then the real subtree replaces
it once.

## Component presentation reference

`presentation` belongs in a registry component's `contract.json`. It defines
the reusable default for every use of that browser-only component; it is not a
metadata key.

### `layout: "none"`

Use this for providers and portals that add no document-flow UI, such as a
toast provider:

```json
{
  "environment": ["browser"],
  "presentation": { "layout": "none" }
}
```

Heron renders the temporary boundary with `display: contents`, so it reserves
no fake height. Do not use `none` for something that eventually adds in-flow
UI.

### `layout: "reserved"`

Use this for a visual component with a predictable reusable footprint.
`placeholder` is required and describes the boundary that occupies its place:

```json
{
  "environment": ["browser"],
  "presentation": {
    "layout": "reserved",
    "placeholder": {
      "width": "100%",
      "minHeight": 320,
      "className": "rounded-xl bg-muted"
    }
  }
}
```

`presentation.placeholder` is a layout box, not a component tree. It supports:

| Field | Meaning | Example |
| --- | --- | --- |
| `className` | CSS classes applied to the boundary | `"aspect-video bg-muted"` |
| `minHeight` | Minimum height; the boundary may grow | `320` or `"20rem"` |
| `minWidth` | Minimum width; the boundary may grow | `240` or `"15rem"` |
| `width` | Explicit width | `"100%"` or `640` |
| `height` | Explicit height | `360` or `"50vh"` |
| `style` | Additional inline React styles | `{ "aspectRatio": "16 / 9" }` |

Numeric dimensions use React's style rules (for example, `320` becomes
`320px` for `minHeight`). String values can use any valid CSS unit. Style
property names use React's camelCase form. If the same property appears in
both `style` and a top-level size field, the value in `style` wins.

#### Class-based reservation

Use classes when the component's size is already part of the app's SSR-loaded
CSS:

```json
{
  "presentation": {
    "layout": "reserved",
    "placeholder": {
      "className": "aspect-video w-full rounded-xl bg-muted"
    }
  }
}
```

The class must be available in the initial server stylesheet; a class loaded
only after hydration cannot reserve the initial space.

#### Minimum-size reservation

Use minimum dimensions for responsive components that may grow with their
container or content:

```json
{
  "presentation": {
    "layout": "reserved",
    "placeholder": {
      "width": "100%",
      "minWidth": 240,
      "minHeight": "20rem"
    }
  }
}
```

#### Fixed-size reservation

Use `width` and `height` when the final component has an exact footprint:

```json
{
  "presentation": {
    "layout": "reserved",
    "placeholder": {
      "width": 640,
      "height": 360
    }
  }
}
```

#### Inline-style reservation

Use `style` for CSS properties not represented by the size shortcuts:

```json
{
  "presentation": {
    "layout": "reserved",
    "placeholder": {
      "width": "100%",
      "style": {
        "aspectRatio": "16 / 9",
        "backgroundColor": "#f1f5f9",
        "borderRadius": "0.75rem"
      }
    }
  }
}
```

The fields can be combined. The reservation is stable only when the resulting
box matches the real component's footprint.

## Widget and layout placeholder reference

`placeholder` belongs in `metadata.json` on an `egret:core:widget` or
`egret:core:layout`. This ability already existed before the hydration
stability update. There is no `presentation` key in widget metadata.

- On SSR, add `renderMode: "client-only"` when that widget/layout cannot render
  on the server. Its placeholder represents the opaque server boundary.
- On CSR web and mobile, a placeholder can be used on any widget/layout as its
  initial resource-loading UI; it does not need `renderMode: "client-only"`.
- On hydrated universal SSR widgets, the already-visible server tree stays in
  place, so Heron does not replace it with the placeholder.

### Size-only placeholder

The size fields and their behavior are the same as
`presentation.placeholder`:

```json
{
  "component": "egret:core:widget",
  "id": "client-chart",
  "renderMode": "client-only",
  "placeholder": {
    "className": "rounded-xl bg-muted",
    "minHeight": 320,
    "minWidth": 240,
    "width": "100%",
    "height": "40vh",
    "style": {
      "maxHeight": 480,
      "border": "1px solid #e2e8f0"
    }
  },
  "children": []
}
```

### Skeleton-tree placeholder

A widget placeholder can be one SSR-safe metadata component tree instead of a
box:

```json
{
  "component": "egret:core:widget",
  "id": "client-card",
  "renderMode": "client-only",
  "placeholder": {
    "component": "egret:core:div",
    "id": "card-skeleton",
    "props": {
      "className": "card-skeleton"
    },
    "children": []
  },
  "children": []
}
```

Use only universal, SSR-safe components inside a skeleton.

For a placeholder that must appear before widget CSS or native styles finish
loading, make its footprint self-contained with numeric/percentage box fields
or styles that are already available globally. `className` is web-only;
portable mobile skeletons should put React Native-compatible styles on their
child component props.

### Box plus skeleton children

Combine the layout box with one or more skeleton trees under
`placeholder.children`:

```json
{
  "component": "egret:core:widget",
  "id": "client-child",
  "renderMode": "client-only",
  "placeholder": {
    "className": "card border-warning shadow-sm",
    "minHeight": 132,
    "children": [
      {
        "component": "egret:core:div",
        "id": "skeleton-title",
        "props": {
          "style": { "height": 24, "width": "70%", "background": "rgba(0,0,0,0.08)" }
        }
      }
    ]
  },
  "children": [
    /* the real, client-only UI — mounted after hydration */
  ]
}
```

### Multiple skeleton roots

Use an array when the placeholder needs multiple sibling trees and no outer
box configuration:

```json
{
  "component": "egret:core:widget",
  "id": "client-results",
  "renderMode": "client-only",
  "placeholder": [
    {
      "component": "egret:core:div",
      "id": "skeleton-heading",
      "props": { "className": "skeleton-heading" },
      "children": []
    },
    {
      "component": "egret:core:div",
      "id": "skeleton-body",
      "props": { "className": "skeleton-body" },
      "children": []
    }
  ],
  "children": []
}
```

The nearest client-only widget or layout owns the boundary and its placeholder
represents that entire subtree. Ordinary component nodes do not accept a
per-instance metadata placeholder; they use their registry
`presentation` contract instead.

- `placeholder` can therefore be a size box, one component tree, an array of
  component trees, or a box with `children`.
- Heron does not guess a generic height. A guessed `2.5rem` box cannot preserve
  the layout of an arbitrary chart, editor, or provider.
- If neither metadata nor the component contract makes the layout knowable,
  an SSR route uses an atomic first reveal. The complete tree mounts behind
  the initial page surface and is exposed once, in its final layout.

## Deterministic reveal rules

- SSR page + only universal components → server HTML is visible immediately;
  hydration adopts it and never replaces it with loading UI.
- SSR page + client-only `layout: "none"` component → server HTML is visible
  immediately; the zero-layout boundary downloads and mounts its bundle in
  place.
- SSR page + client-only `layout: "reserved"` component → server HTML and the
  declared reservation are visible immediately; the final component replaces
  that reservation without changing its footprint.
- SSR page + client-only widget/layout `placeholder` → the authored box or
  skeleton represents that complete opaque subtree until it mounts.
- SSR page + client-only component with unknown layout → the initial atomic
  surface is visible first; the hidden real tree completes, then Heron reveals
  it once. Partial SSR is never shown and then collapsed.
- CSR web + authored widget/layout `placeholder` → show it while bundles,
  declared translations, and widget CSS load; replace it once with the real
  translated and styled subtree.
- CSR mobile + authored widget/layout `placeholder` → show it while bundles,
  declared translations, and the native widget stylesheet load; replace it
  once with the real subtree.
- CSR/mobile without an authored placeholder → keep using the generic themed
  fallback until the widget's first visible mount.

Visual readiness and script readiness are separate. A client boundary can
load independently without hiding its SSR ancestors, but it does not emit
`component_ready` until the real instance mounts. Parent widget scripts still
wait for their real children, including client-only children.

## The nesting rule

A `client-only` widget is an **opaque boundary** — everything under it stops
rendering on the server, even descendants that could otherwise render
universally. Only the *nearest* client-only ancestor owns a placeholder; you
don't need to (and shouldn't) mark every nested client-only child separately.

## How to tell it's working

Inspect the rendered HTML for `data-heron-render-mode="client-only"` on the
boundary `<div>` — that's the placeholder marker present in the initial
server response, replaced by the real content after hydration:

```bash
curl -sS http://localhost:5173/some-ssr-route | grep 'data-heron-render-boundary'
```

For the catch-all path, inspect
`data-heron-initial-reveal="atomic"`. Its state is `pending` in the server
response and becomes `ready` once the real tree is ready.

On a CSR route, an authored widget fallback has
`data-heron-widget-resource-placeholder`. It exists only while that widget's
resource gate is pending.

See [Using SSR](/docs/guides/ssr/using-ssr) for how to opt a route into SSR in
the first place.
