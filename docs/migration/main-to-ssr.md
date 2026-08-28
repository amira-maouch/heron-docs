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
  to call server-side logic from a widget without a full API route.
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

### 1. Update dependencies

Pull the branch's package versions for `@heron-ws/app-runtime`,
`@heron-ws/app-runtime-server`, `@heron-ws/component-api`, `@heron-ws/i18n`,
`@heron-ws/page-engine`, `@heron-ws/page-engine-components`.

### 2. Leave `ssr` unset and verify nothing broke

Deploy with no `ssr` block in `app.config.ts` at all. Your app should behave
identically to `main` — this is your regression baseline before opting into
anything.

### 3. Turn on SSR for one low-risk route first

```ts
// app.config.ts
ssr: { enabled: true, abortTimeoutMs: 10_000 },
```
```json
// app-manifest.json
"about": { "widget": "pages/about", "ssr": true }
```

Pick a simple, public, non-authenticated page first — not your most complex
dashboard.

### 4. Audit that route's widget tree for browser-only code

Anything using `window`, `document`, `localStorage`, or a browser-only
library needs either: a server-safe fallback, or `renderMode: "client-only"` +
a `placeholder` (see [CSR Placeholders](/docs/guides/ssr/csr-placeholders)).

### 5. Add loaders where you want server-fetched data

`server.ts` next to that widget's `metadata.json` — see
[Using SSR](/docs/guides/ssr/using-ssr).

### 6. Add SEO fields for that route

See [Adding SEO to Pages](/docs/guides/ssr/seo).

### 7. Expand route by route

Repeat steps 3–6. There's no requirement to migrate every route — CSR and SSR
routes coexist in the same app indefinitely.

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
