---
sidebar_position: 6
---

# How to Add a Route

Routes live in `app-manifest.json`. Each entry maps a URL slug to a widget
(and optionally a layout).

## Basic route

```json
"routes": {
  "dashboard": {
    "widget": "pages/dashboard",
    "layout": "layouts/main-layout",
    "title": "Dashboard"
  }
}
```

`https://yourapp/<appPathPrefix>/dashboard` renders
`widgets/pages/dashboard/metadata.json` wrapped in
`widgets/layouts/main-layout` inside the always-on `widgets/root`.

## `appPathPrefix`

```json
"routing": { "appPathPrefix": "app" }
```

Every route above is served under `/app/...` (e.g. `/app/dashboard`). Set it
to an empty string to serve routes at the site root.

## Dynamic segments

`:name` segments capture URL params:

```json
"report-view/:reportId": {
  "widget": "pages/reports/view",
  "layout": "layouts/main-layout"
}
```

Static segments always win over `:param` segments when both could match, and
longer exact matches win over shorter/prefix ones.

## Nested routes

`children` express hierarchy and flatten into fully-qualified routes, real
example from `alefbab_app`:

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
`/project-demo/:id/tasks`, `/project-demo/:id/report`. Children inherit the
parent's `layout` unless they set their own or pass `overrideLayout: true`.

## 404s

```json
"errorRoutes": { "404": { "widget": "pages/errors/not-found" } }
```

## Gating a route behind permissions

```json
"users": {
  "widget": "pages/users",
  "can": { "any": [{ "action": "read", "subject": "User" }] }
}
```

See [Authentication & Authorization](/docs/guides/authentication-and-authorization).
