---
sidebar_position: 1
---

# How to Add a Widget

A widget is a folder under `widgets/` with a `metadata.json` and, optionally,
a script, a server-side data loader, styles, and translations.

## 1. Create the folder

```
widgets/pages/my-feature/
├── metadata.json          # required
├── script.ts               # optional — client behavior
├── server.ts                # optional — server-side data loader
├── styles.css                # optional — extra scoped CSS
└── translations/_self/
    ├── en.json
    └── ar.json
```

This is the real shape of `alefbab_app`'s `widgets/pages/auth/login/` folder —
use it as the template for any new page widget.

## 2. Write `metadata.json`

Every node needs a `component` (`registry:namespace:type` — exactly three
colon-separated parts) and an `id`. Give a node an `alias` when `script.ts`
needs to reach it directly:

```json
{
  "component": "egret:core:div",
  "id": "my-feature-root",
  "props": { "className": "flex flex-col gap-4 p-6" },
  "children": [
    {
      "component": "shadcn:shadcn:button",
      "id": "my-feature-save-btn",
      "alias": "@saveBtn",
      "props": { "children": "t:pages/my-feature.save" }
    }
  ]
}
```

- `"t:pages/my-feature.save"` pulls from this widget's own
  `translations/_self/{locale}.json` — see
  [How to Add Translations](/docs/guides/widgets/how-to-add-translations).
- `component` values like `shadcn:shadcn:button` must already be vendored —
  see [How to Add a Component to the Registry](/docs/guides/setup/vendor-a-registry-component).

## 3. Wire up behavior (optional)

```ts
// script.ts
const myFeatureScript = ($egret: any, $self: any) => {
  $self.getChild("@saveBtn")?.listen({
    onClick: async () => {
      // ...
    },
  });
};
export default myFeatureScript;
```

Full API surface: [Widget Scripts & APIs](/docs/guides/widgets/widget-scripts-and-apis).

## 4. Register a route

Widgets aren't routable on their own — add an entry to `app-manifest.json`:

```json
"my-feature": {
  "widget": "pages/my-feature",
  "layout": "layouts/main-layout",
  "title": "My Feature"
}
```

See [How to Add a Route](/docs/guides/widgets/how-to-add-a-route) next. (Don't worry
about the `layout` field yet — that's covered right after.)

## Not every screen needs a new widget

If the UI is only ever used inside one existing page, it may not need to be
its own widget at all — see
[Component vs. Subtree vs. Widget](/docs/guides/widgets/component-vs-subtree-vs-widget).
