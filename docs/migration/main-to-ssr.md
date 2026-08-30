---
sidebar_position: 2
title: main → SSR branch
---

# Migrating from `main` to the SSR branch

If your app is built against Heron `main`, this covers what changes when you
move to `874-add-ssr-support-to-heron` — the branch that adds server-side
rendering, dynamic SEO, and CSR-only placeholders. It's a large branch (216
files, ~24k lines) but most of it is new, additive code. This guide covers
what actually affects **your app**, not the internals.

## Is this migration required?

No. SSR is opt-in at the app level (`ssr.enabled`) — everything on `main`
keeps working unchanged if you don't turn it on. Migrate when you actually
need faster first paint or crawlable pages for some routes.

## What's new (additive, safe to ignore until you opt in)

- Server-side rendering: `renderHeronDocument()`, a new document HTTP handler,
  streamed HTML responses.
- `renderMode: "client-only"` + `placeholder` on widgets — see
  [CSR Placeholders](/docs/guides/ssr/csr-placeholders).
- Dynamic SEO resolution (title/meta/canonical/OG/Twitter) and generated
  `robots.txt`/`sitemap.xml` — see [Adding SEO to Pages](/docs/guides/ssr/seo).
- Server actions (`packages/app-runtime-core/src/serverActions/`) — a new way
  to call server-side logic from a widget without a full API route. See
  [How to Add a Server Action](/docs/guides/widgets/server-actions).
- `$select`/`cases` metadata expressions — declarative, server-renderable
  branching on locale/theme/route state directly in `metadata.json`. See
  [`$select` and `cases`](/docs/guides/widgets/metadata-expressions).
- Widget HMR rework (`widgetHmr/`) — faster dev-server reloads, no app changes
  needed.
- Extensive new test coverage for the SSR path — nothing you need to write
  yourself unless you're contributing to the framework.

## Breaking / behavior changes to check

| Area | What changed | What to check in your app |
|---|---|---|
| `app-manifest.json` | Routes gained optional `ssr` and richer `seo` fields | No action unless you want to use them — existing manifests remain valid |
| `docs/manifest.md` | Substantially rewritten | Re-read if you maintain manifest tooling |
| `docs/authorization.md` | Auth types gained SSR-aware fields (`AuthStore`, cookie handling) | If you use a custom `AuthAdapter`, diff your adapter against the updated `AuthAdapter` type |
| `ComponentRuntime.ts` | +457/-lines — auth store, i18n, and lifecycle all gained SSR-scoped variants | If you call low-level `$egret` internals directly (not `$self`), re-check signatures |
| i18n | `translator.ts`, `locale-state.ts` gained server-scoped instance creation | No action for normal `$self.t()`/`$egret.t()` usage |
| `theme-engine.ts` | Rewritten (168 lines changed) | If you use `$egret.theme` only through the documented API, unaffected |

Nothing in this diff renames or removes an existing `$self`/`$egret` method
used by widget scripts — the breaking-change surface is almost entirely new
opt-in fields, not removed ones.

## Step-by-step

### 1. Point your app at the SSR-branch packages

:::caution No published "SSR" version yet
As of this branch, the SSR work (and server actions) exist only as
**unreleased changesets** in the heron repo — there is no published npm
version or dist-tag for it. Don't look for something like a `-ssr` version
suffix; it doesn't exist.
:::

The real, current pattern (from `bootstrap_app` and `doubleguard-crm`, both
built against this branch) is to link `package.json` straight at your local
heron checkout instead of a registry version:

```json
"dependencies": {
  "@heron-ws/app-runtime": "file:../heron/packages/app-runtime",
  "@heron-ws/component-api": "file:../heron/packages/component-api",
  "@heron-ws/i18n": "file:../heron/packages/i18n"
},
"pnpm": {
  "overrides": {
    "@heron-ws/app-runtime-core": "file:../heron/packages/app-runtime-core",
    "@heron-ws/app-runtime-server": "file:../heron/packages/app-runtime-server",
    "@heron-ws/component-registry": "file:../heron/packages/component-registry",
    "@heron-ws/page-engine": "file:../heron/packages/page-engine",
    "@heron-ws/page-engine-components": "file:../heron/packages/page-engine-components",
    "@heron-ws/utils": "file:../heron/packages/utils"
  }
}
```

The `pnpm.overrides` block matters — without it, transitive `@heron-ws/*`
deps other packages pull in can resolve to a different (registry) version
than the one you linked directly, and you'll get subtly inconsistent
behavior. Once this work is actually published, this step will change —
check back here before assuming a registry version exists.

### 2. Add the `build:ssr` step

```json
"scripts": {
  "build": "vite build && pnpm build:ssr && egret-build-app",
  "build:ssr": "node ./node_modules/@heron-ws/app-runtime/bin/build-ssr.js"
}
```

This replaces the old two-step `"vite build && egret-build-app"` — `build:ssr`
slots in between, producing the server-render entry bundle. It's safe to add
even before you turn `ssr.enabled` on.

### 3. Leave `ssr` unset and verify nothing broke

Deploy with no `ssr` block in `app.config.ts` at all. Your app should behave
identically to `main` — this is your regression baseline before opting into
anything.

### 4. Turn on SSR for one low-risk route first

```ts
// app.config.ts
ssr: { enabled: true, default: false, abortTimeoutMs: 10_000 },
```
```json
// app-manifest.json
"about": { "widget": "pages/about", "ssr": true }
```

Pick a simple, public, non-authenticated page first — not your most complex
dashboard. See [Using SSR § When to use it](/docs/guides/ssr/using-ssr#when-to-use-it)
for how to decide which routes deserve SSR at all.

### 5. Audit that route's widget tree for browser-only code

Anything using `window`, `document`, `localStorage`, or a browser-only
library needs either: a server-safe fallback, or `renderMode: "client-only"` +
a `placeholder` (see [CSR Placeholders](/docs/guides/ssr/csr-placeholders)).
Left unaddressed, that part of the tree just renders its placeholder (or the
default empty box) instead of real content — SSR doesn't error, it silently
degrades to "no content there yet," which is easy to miss in a quick check.

A real example of this kind of fix: `alefbab_app`'s sidebar decides its
LTR/RTL docking side in `script.ts`, reading `document.documentElement`'s
`dir` attribute — that can't run during SSR (`document` doesn't exist on the
server) and defaults to `"ltr"` until the client script corrects it after
hydration:

```ts
// client-only — can't resolve during SSR
const getDocumentDir = (): "ltr" | "rtl" => {
  if (typeof document === "undefined") return "ltr";
  return document.documentElement.getAttribute("dir") === "rtl" ? "rtl" : "ltr";
};
```

The SSR-safe fix is to move that decision into metadata, using
[`$select`/`cases`](/docs/guides/widgets/metadata-expressions) against `$i18n.direction`
instead — this resolves identically on the server and the client, no
hydration flash:

```json
"side": {
  "$select": "$i18n.direction",
  "cases": { "ltr": "left", "rtl": "right" }
}
```

The general pattern: anywhere a widget reads `document`/`window`/`localStorage`
just to branch on locale, theme, or a route param, check whether
`$select`/`cases` can replace it before reaching for `renderMode: "client-only"`.

### 6. Add loaders where you want server-fetched data

`server.ts` next to that widget's `metadata.json` — see
[How to Add a Widget Data Loader](/docs/guides/widgets/widget-data-loaders).

### 7. Add SEO fields for that route

See [Adding SEO to Pages](/docs/guides/ssr/seo).

### 8. Expand route by route

Repeat steps 4–7. There's no requirement to migrate every route — CSR and SSR
routes coexist in the same app indefinitely.

## Optional: other patterns you'll see in SSR-ready apps

Not everything SSR-ready apps do is required by the framework — some are just
choices individual apps made. One worth knowing about so it doesn't look like
a missing step: `doubleguard-crm` links `index.css` directly from
`index.html` instead of importing it in `main.tsx`:

```html
<!-- index.html -->
<link rel="stylesheet" href="/index.css" />
```
```ts
// main.tsx — no CSS import
import "@heron-ws/app-runtime/shell";
```

`bootstrap_app`, also SSR-ready, does **not** do this — it still imports CSS
in `main.tsx` the same way `alefbab_app` does. Neither is required by SSR
itself; treat it as an available option (it can avoid a flash of unstyled
content on the very first server-rendered paint), not a migration step.

## Verifying the migration

- `pnpm test:ssr-import` — server bundle never touches browser globals.
- `pnpm test` — full suite, including the new SSR-path tests
  (`resolvePageRequest.*`, `widgets.parity.test.ts` compares SSR vs CSR
  output for parity).
- Manual check per migrated route: View Page Source, disable JS and reload,
  `curl` the route directly. Full checklist:
  [Using SSR § Testing SSR locally](/docs/guides/ssr/using-ssr#testing-ssr-locally).

## Rollback

Per-route: remove `"ssr": true` from that route's manifest entry (or set it
to `false` explicitly) — it falls back to CSR immediately, no code changes
needed. App-wide: set `ssr.enabled: false` in `app.config.ts` — every route
serves CSR regardless of individual route settings.
