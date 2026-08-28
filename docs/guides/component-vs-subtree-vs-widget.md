---
sidebar_position: 4
---

# Component, Subtree, or Widget?

Three different ways to structure UI in Heron, and how to pick.

## Registry component

A self-contained, reusable UI primitive with **no app-specific logic** —
`shadcn:shadcn:button`, `ui:display:avatar`, `ui:feedback:spinner`. You don't
author these per-app; you vendor them (see
[How to Add a Component to the Registry](/docs/guides/how-to-add-a-component-to-the-registry))
and reference them by id in any `metadata.json`.

**Use when**: the thing you need is generic UI with no knowledge of your
app's data or routes — a button, a badge, a date picker.

## Subtree (nested children in a widget)

Plain nodes inside a widget's `metadata.json` `children` array. This is the
default — most of a page's UI is just subtree.

**Use when**: the markup is only ever used in this one widget. It doesn't
need its own translations namespace, its own SSR loader, or to be reused
elsewhere. Real example — a page's error/success alerts, form fields, and
buttons are all subtree inside `widgets/pages/system/user-settings/metadata.json`,
wired up by that same widget's single `script.ts`.

## Standalone widget (+ `section-reference`)

A separate folder under `widgets/`, embedded into a parent via
`egret:core:section-reference`:

```json
{
  "component": "egret:core:section-reference",
  "id": "header",
  "ref": { "path": "shell/app-header" },
  "props": { "className": "sticky top-0 z-30 shrink-0" }
}
```

**Use when** any of these is true:
- It's reused across multiple pages/layouts (a header, a sidebar menu).
- It needs its own SSR data loader (`server.ts`).
- It needs its own translation namespace, independent of the page that
  happens to embed it.
- It has its own route — every routed page (`app-manifest.json` → `widget`)
  is, by definition, a standalone widget.

## Quick rule of thumb

| Question | Answer |
|---|---|
| Is it generic, app-agnostic UI? | Registry component |
| Is it used in exactly one place? | Subtree |
| Is it reused, routed, or needs its own loader/translations? | Standalone widget (`section-reference`) |
