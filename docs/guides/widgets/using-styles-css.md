---
sidebar_position: 7
---

# Using `styles.css`

A widget can have its own `styles.css`, next to `metadata.json`. This is for
CSS that utility classes in `className` props can't express cleanly — it's
not where most styling should live.

:::info Setting up the CSS library itself
This page is about the per-widget file. For installing/configuring Tailwind,
Bootstrap, or another library so `className` works at all, see
[Styling Libraries](/docs/guides/styles/tailwind).
:::

## When to reach for it

Most styling belongs directly in `metadata.json` as utility classes:

```json
{ "props": { "className": "flex flex-col gap-4 p-6" } }
```

Add a `styles.css` when you need something utilities don't cover well —
`color-mix`, complex gradients, or targeting a registry component's internal
structure via its `data-slot` attributes. Real example,
`widgets/pages/auth/login/styles.css`:

```css
.login-widget [data-slot="card"] {
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--border) 35%, transparent),
    0 16px 40px -24px rgb(0 0 0 / 0.45);
}
```

Another real example, scoping table row borders in
`widgets/pages/system/settings/styles.css`:

```css
.users-panel [data-slot="table-row"] td {
  border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}
.users-panel [data-slot="table-row"]:last-child td {
  border-bottom: none;
}
```

## Scoping

There's no automatic CSS scoping — `styles.css` is plain, global CSS. Scope it
yourself by nesting selectors under the widget's own root className (like
`.login-widget` and `.users-panel` above), so rules can't leak into other
widgets that happen to reuse the same registry component.

## Theming

Reach for the active theme's CSS variables (`--background`, `--border`,
`--primary`, ...) rather than hardcoded colors, so the widget respects theme
and light/dark switching automatically — see
[App Structure § `themes/`](/docs/heron/app-structure#themes).
