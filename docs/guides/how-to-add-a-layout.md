---
sidebar_position: 1
---

# How to Add a Layout

A layout is a widget that wraps page content with shared chrome — header,
sidebar, footer — and leaves a slot where the matched route's widget mounts.

## 1. Create the widget

```
widgets/layouts/my-layout/metadata.json
```

Real example, `doubleguard-webapp`'s `widgets/layouts/app-shell/metadata.json`:

```json
{
  "component": "egret:core:div",
  "id": "shell",
  "props": { "className": "min-h-screen bg-background text-foreground flex flex-col" },
  "children": [
    {
      "component": "egret:core:section-reference",
      "id": "header",
      "ref": { "path": "shell/app-header" },
      "props": { "className": "sticky top-0 z-30 shrink-0" }
    },
    {
      "component": "egret:core:div",
      "id": "content",
      "props": { "className": "flex-1 flex flex-col", "role": "main" },
      "children": [
        { "component": "egret:core:slot", "id": "page-content", "props": { "className": "flex-1" } }
      ]
    },
    {
      "component": "egret:core:section-reference",
      "id": "footer",
      "ref": { "path": "shell/app-footer" },
      "props": { "className": "shrink-0" }
    }
  ]
}
```

Two things do the actual work:
- `egret:core:slot` — the matched route's widget renders here.
- `egret:core:section-reference` (`ref.path`) — embeds another widget (here,
  `widgets/shell/app-header`) as a reusable chunk of chrome. This is how you
  share a header/sidebar across many layouts without copy-pasting it.

## 2. Wire it to routes

Reference the layout folder path from `app-manifest.json`:

```json
"dashboard": {
  "widget": "pages/dashboard",
  "layout": "layouts/main-layout",
  "title": "Dashboard"
}
```

## 3. Layout inheritance

A nested route with no `layout` of its own inherits the nearest ancestor
route's layout. Set `"overrideLayout": true` to break out of it — real
example, a report page that needs a fullscreen layout instead of the parent's:

```json
"report": {
  "widget": "pages/dev/routing-demo-report",
  "layout": "layouts/fullscreen-layout",
  "overrideLayout": true,
  "title": "Project Report"
}
```

See [How to Add a Route](/docs/guides/how-to-add-a-route) for the full routing
model.
