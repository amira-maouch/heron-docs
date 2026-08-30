---
sidebar_position: 4
---

# How to Add a Layout

A layout is chrome — header, sidebar, footer — shared by a group of routes.
Unlike the [root layout](/docs/guides/widgets/root-layout) (always on, every route),
a layout is opt-in: you attach it to specific routes via `app-manifest.json`.

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
- `egret:core:slot` — the matched route's widget renders here (this layout's
  own `page-content` slot, itself nested inside the root layout's
  `page-outlet` slot).
- `egret:core:section-reference` (`ref.path`) — embeds another widget (here,
  `widgets/shell/app-header`) as a reusable chunk of chrome. This is how you
  share a header/sidebar across many layouts without copy-pasting it.

## 2. Wire it to a route

```json
"dashboard": {
  "widget": "pages/dashboard",
  "layout": "layouts/main-layout",
  "title": "Dashboard"
}
```

Routes with no `layout` render directly inside the root layout, with no extra
chrome — fine for a login page or a fullscreen view.

## Nested routes and layout inheritance

`children` in `app-manifest.json` express route hierarchy and flatten into
fully-qualified routes. A nested route with no `layout` of its own inherits
the nearest ancestor's layout — real example, `alefbab_app`:

```json
"project-demo": {
  "widget": "pages/dev/routing-demo-list",
  "layout": "layouts/main-layout",
  "title": "Project List",
  "children": {
    ":id": {
      "widget": "pages/dev/routing-demo-detail",
      "title": "Project Detail",
      "children": {
        "tasks": {
          "widget": "pages/dev/routing-demo-tasks",
          "title": "Project Tasks"
        },
        "report": {
          "widget": "pages/dev/routing-demo-report",
          "layout": "layouts/fullscreen-layout",
          "overrideLayout": true,
          "title": "Project Report"
        }
      }
    }
  }
}
```

This gives you `/project-demo`, `/project-demo/:id`,
`/project-demo/:id/tasks`, `/project-demo/:id/report`. `tasks` inherits
`project-demo`'s `layouts/main-layout` automatically. `report` needs a
different, fullscreen layout — it sets its own `layout` **and**
`overrideLayout: true` to break out of the inherited one rather than nesting
inside it.

See [How to Add a Route](/docs/guides/widgets/how-to-add-a-route) for the rest of the
routing model (dynamic segments, `appPathPrefix`, 404s, gating with `can`).
