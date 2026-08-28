---
sidebar_position: 5
---

# How to Add a Route

Routes live in `app-manifest.json`. Each entry maps a URL slug to a widget.

## Basic route

```json
"routes": {
  "dashboard": {
    "widget": "pages/dashboard",
    "title": "Dashboard"
  }
}
```

`https://yourapp/<appPathPrefix>/dashboard` renders
`widgets/pages/dashboard/metadata.json`, wrapped inside the always-on
`widgets/root` (see [The Root Layout](/docs/guides/root-layout) — every route
gets this automatically, nothing to configure here).

You can also wrap a route in a named `layout` (shared header/sidebar/footer
chrome) — that's the next guide,
[How to Add a Layout](/docs/guides/how-to-add-a-layout), once you know what a
route is.

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
  "widget": "pages/reports/view"
}
```

Static segments always win over `:param` segments when both could match, and
longer exact matches win over shorter/prefix ones.

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

## Next

Routes can also nest, and inherit or override a layout — that builds on
[How to Add a Layout](/docs/guides/how-to-add-a-layout), so it's covered
there once layouts make sense.
