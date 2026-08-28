---
sidebar_position: 2
title: CSR Placeholders in SSR Routes
---

# CSR Placeholders in SSR Routes

Some widgets can't render on the server — a map, a canvas editor, anything
that needs `window`. On an SSR route, mark them `client-only` and give them a
placeholder so the layout doesn't jump when they hydrate.

## Marking a widget client-only

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

- `placeholder` can be a size box (`minHeight`/`minWidth`/`className`), a
  small component tree (skeleton UI, shown above), or both.
- If you omit `placeholder` entirely, Heron falls back to reserving
  `minHeight: 2.5rem` so the boundary is never zero-height and doesn't cause
  layout shift.

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

See [Using SSR](/docs/guides/ssr/using-ssr) for how to opt a route into SSR in
the first place.
