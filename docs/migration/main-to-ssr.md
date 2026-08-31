---
sidebar_position: 2
title: main → SSR branch
---

# Migrating from `main` to the SSR branch

If your app is built against Heron `main`, this covers what changes when you
move to `874-add-ssr-support-to-heron` — the branch that adds server-side
rendering, dynamic SEO, and CSR-only placeholders. Most of it is new,
additive code; this guide only covers what actually affects **your app**.

## Is this migration required?

No. SSR is opt-in at the app level (`ssr.enabled`). Everything on `main`
keeps working unchanged if you don't turn it on — migrate when you actually
need faster first paint or crawlable pages for some routes.

## What's new

| Feature                                     | What it gives you                                                   | Guide                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Server-side rendering                       | Real HTML on first response, not just an empty shell                | [Using SSR](/docs/guides/ssr/using-ssr)                            |
| `renderMode: "client-only"` + `placeholder` | A way to mark browser-only widgets so SSR degrades gracefully       | [CSR Placeholders](/docs/guides/ssr/csr-placeholders)              |
| Dynamic SEO + `robots.txt`/`sitemap.xml`    | Title/meta/canonical/OG/Twitter resolved per request                | [Adding SEO to Pages](/docs/guides/ssr/seo)                        |
| Server actions                              | Call server-only logic on demand from a widget, no API route needed | [How to Add a Server Action](/docs/guides/widgets/server-actions)  |
| `$select`/`cases` metadata expressions      | Declarative, server-renderable branching in `metadata.json`         | [`$select` and `cases`](/docs/guides/widgets/metadata-expressions) |
| Widget HMR rework                           | Faster dev-server reloads                                           | — no app changes needed                                            |

## Breaking changes to check

| Area                | What changed                                               | What to check in your app                                                                      |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app-manifest.json` | Routes gained optional `ssr` and `seo` fields              | Nothing — existing manifests stay valid as-is                                                  |
| `AuthAdapter`       | Gained SSR-aware fields (cookie handling)                  | Diff your adapter against the updated type if you have a custom one                            |
| `$egret` internals  | Auth store, i18n, and lifecycle gained SSR-scoped variants | Only matters if you call low-level internals directly, not `$self`/documented `$egret` methods |

Nothing in this diff renames or removes an existing `$self`/`$egret` method
used by widget scripts — the change surface is almost entirely new, opt-in
fields.

## Step-by-step

### 1. Install the SSR-tagged packages

There **is** a published version for this work — it's distributed under the
`ssr` npm dist-tag, not on `latest`:

```bash
pnpm view @heron-ws/app-runtime@ssr version
# 0.0.0-ssr-20260828134038
```

Install the packages your app uses from that tag instead of a normal semver
range:

```bash
pnpm add @heron-ws/app-runtime@ssr @heron-ws/component-api@ssr
```

or change the version in package.json like:

```json
"@heron-ws/app-runtime": "0.0.0-ssr-20260828134038"
```

### 2. Add the `build:ssr` step

```json
"scripts": {
  "build": "vite build && pnpm build:ssr && egret-build-app",
  "build:ssr": "node ./node_modules/@heron-ws/app-runtime/bin/build-ssr.js"
}
```

`build:ssr` slots between the old two steps and produces the server-render
entry bundle. Safe to add even before `ssr.enabled` is on.

### 3. Move `index.css` into `index.html`

```html
<!-- index.html -->
<link rel="stylesheet" href="/index.css" />
```

```ts
// main.tsx — no CSS import anymore
import "@heron-ws/app-runtime/shell";
```

Importing CSS from `main.tsx` (the old pattern) means the very first
server-rendered paint can flash unstyled before the client bundle applies it.
Linking it from `index.html` instead avoids that.

### 4. Leave `ssr` unset and verify nothing broke

Your app should behave
identically to `main` — this is your regression baseline before opting into
anything.

### 5. Turn on SSR for one low-risk route

```ts
// app.config.ts
ssr: { enabled: true, default: false, abortTimeoutMs: 10_000 },
```

```json
// app-manifest.json
"about": { "widget": "pages/about", "ssr": true }
```

Pick a simple, public, non-authenticated page first. See
[Using SSR § When to use it](/docs/guides/ssr/using-ssr#when-to-use-it) for
how to decide which routes deserve SSR at all.

### 6. Audit that route for browser-only code

Anything using `window`, `document`, `localStorage`, or a browser-only
library needs a server-safe fallback, or `renderMode: "client-only"` +
`placeholder` (see [CSR Placeholders](/docs/guides/ssr/csr-placeholders)).

Left unaddressed, SSR doesn't error — that part of the tree just silently
renders its placeholder (or an empty box) instead of real content, which is
easy to miss in a quick check.

**A real fix, worth knowing as a pattern.** `alefbab_app`'s sidebar decides
its LTR/RTL docking side by reading `document.documentElement`'s `dir`
attribute in `script.ts`:

```ts
// client-only — document doesn't exist on the server
const getDocumentDir = (): "ltr" | "rtl" => {
  if (typeof document === "undefined") return "ltr";
  return document.documentElement.getAttribute("dir") === "rtl" ? "rtl" : "ltr";
};
```

That can't resolve during SSR — it defaults to `"ltr"` and only corrects
itself after hydration. The SSR-safe fix moves the same decision into
metadata with [`$select`/`cases`](/docs/guides/widgets/metadata-expressions),
which resolves identically on the server and the client:

```json
"side": { "$select": "$i18n.direction", "cases": { "ltr": "left", "rtl": "right" } }
```

General rule: anywhere a widget reads `document`/`window`/`localStorage` just
to branch on locale, theme, or a route param, check whether `$select`/`cases`
can replace it before reaching for `renderMode: "client-only"`.

### 7. Add loaders where you want server-fetched data

`server.ts` next to that widget's `metadata.json` — see
[How to Add a Widget Data Loader](/docs/guides/widgets/widget-data-loaders).

### 8. Add SEO fields for that route

See [Adding SEO to Pages](/docs/guides/ssr/seo).

### 9. Expand route by route

Repeat steps 5–8. There's no requirement to migrate every route — CSR and
SSR routes coexist in the same app indefinitely.

### 10. Test it

- Manually, per migrated route: View Page Source, disable JS and reload,
  `curl` the route directly. Full checklist:
  [Using SSR § Testing SSR locally](/docs/guides/ssr/using-ssr#testing-ssr-locally).

## Rollback

**Per-route:** remove `"ssr": true` from that route's manifest entry (or set
it to `false` explicitly) — it falls back to CSR immediately, no code
changes needed.

**App-wide:** set `ssr.enabled: false` in `app.config.ts` — every route
serves CSR regardless of individual route settings.
