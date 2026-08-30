---
sidebar_position: 11
title: "$select and cases"
---

# `$select` and `cases`

A small, declarative way to branch a prop's value based on app state,
directly in `metadata.json` — no `script.ts` needed. It's deliberately
limited: it can't run arbitrary JS, call `$egret`, or read server data — only
a fixed set of state references.

## What it can read

| Reference | Value |
|---|---|
| `$i18n.direction` | `"ltr"` or `"rtl"` |
| `$i18n.locale` | Active locale |
| `$theme.name` | Active theme name |
| `$theme.mode` | `"light"` or `"dark"` |
| `$params.<name>` | A named route param |
| `$searchParams.<name>` | A URL search param |
| `$queryParams[<n>]` | A positional route segment |
| `$props.<name>` | A prop on the nearest widget/layout root |

All of these are reactive — the value re-resolves automatically when
language, theme, or route changes, both server-side (SSR) and client-side
(hydration uses the same expression, re-resolved from the browser's state).

## The syntax

```json
{
  "side": {
    "$select": "$i18n.direction",
    "cases": {
      "ltr": "left",
      "rtl": "right"
    }
  }
}
```

`$select` names which state reference to branch on; `cases` maps its possible
values to whatever you want that prop to actually be — a string, number,
object, array, even another nested expression.

## Real example

`doubleguard-crm`'s sidebar flips which edge of the screen it docks to, based
on the active locale's text direction:

```json
// widgets/shell/sidebar/metadata.json
{
  "component": "shadcn:shadcn:sidebar",
  "id": "app-sidebar",
  "props": {
    "collapsible": "icon",
    "variant": "inset",
    "side": {
      "$select": "$i18n.direction",
      "cases": { "ltr": "left", "rtl": "right" }
    }
  }
}
```

Switch the app to an RTL locale and this sidebar re-docks to the right side —
no `script.ts` involved.

## Fallback with `default`

```json
{
  "density": {
    "$select": "$searchParams.view",
    "cases": { "grid": "comfortable", "table": "compact" },
    "default": "comfortable"
  }
}
```

If the selector's current value doesn't match any key in `cases`, `default`
is used. With no `default` and no match, the prop keeps its unresolved
expression (effectively: nothing changes) — so always add a `default` unless
you're sure every possible value is covered by `cases`.

## When to use it vs. a script

Use `$select`/`cases` when the branch is purely a function of one of the
state references above — locale direction, theme, a route param. Reach for
`script.ts` (`$self.setProps(...)`) instead when the logic needs data from an
API call, more complex conditions, or anything outside that fixed state list.
