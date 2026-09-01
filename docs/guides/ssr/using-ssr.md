---
sidebar_position: 1
title: Using SSR
---

# Using SSR

:::caution[Requires `app-runtime@2.0.0`+]

SSR ships in `@heron-ws/app-runtime@2.0.0`. If your app is still on the
`1.13.x` line, none of this applies yet — see the
[1.13 → 2.0 migration guide](/docs/migration/1.13-to-2.0) when you're ready
to upgrade.

:::

## When to use it

**Public pages** — anything meant to be crawled and indexed — are the main
case: SSR is what makes a page's real content show up in View Source (and
therefore to search engines) instead of an empty shell.

**Private, authenticated pages** (routes gated with `can` — see
[Authorization Checks](/docs/guides/backend-and-auth/authorization-checks)) are, by
definition, not crawlable and don't matter for SEO. Default these to CSR.

The one exception: a `can`-gated page that's very performance-critical and
would genuinely benefit from a faster first paint. You can set `ssr: true` on
it — just make sure of two things:
1. **`can` is still doing the actual protecting.** SSR doesn't bypass
   authorization — the server-side render goes through the same `can` check —
   but double-check that's true for your route rather than assuming it.
2. **Set `"seo": { "index": false }`** on that route explicitly. SSR makes
   the content crawlable by default; a `can`-gated page being fast is not the
   same as it being okay to show up in search results. Without this, an
   authenticated page's content could end up indexed.

## Three levels of opt-in

SSR isn't one flag — three levels, each able to override the one above it:

| Level | Where | Meaning |
|---|---|---|
| App | `app.config.ts` → `ssr.enabled` + `ssr.default` | Is SSR available, and what's the default for routes that don't say? |
| Route | `app-manifest.json` → route `ssr` | Does this URL override the app default? |
| Widget | `renderMode` on a widget | Can this specific subtree render server-side? |

### App level — `enabled` and `default` together decide every route's starting point

```ts
// app.config.ts
ssr: {
  enabled: true,
  default: true, // see the three scenarios below
  abortTimeoutMs: 10_000, // abort a stream that hasn't completed
  cache: {
    publicRoutes: ["/login"],
    maxAgeSeconds: 30,
    maxEntries: 50,
  },
},
```

Three scenarios, depending on `enabled`/`default`:

| `ssr.enabled` | `ssr.default` | Routes with no `ssr` field | How to opt a route the other way |
|---|---|---|---|
| `false` / unset | — | All CSR | Not possible — `ssr: true` on a route is ignored |
| `true` | `true` | All SSR | Set `"ssr": false` per route to keep it CSR |
| `true` | `false` / unset | All CSR | Set `"ssr": true` per route to make it SSR |

### Route level

```json
"dashboard": { "widget": "pages/dashboard", "ssr": true },
"csr-only-page": { "widget": "pages/legacy", "ssr": false }
```

Precedence: app `ssr.enabled` gate → explicit route `ssr` → `ssr.default` →
CSR.

## Loading data server-side

Widgets fetch data before render via `server.ts` — that's covered in its own
guide: [How to Add a Widget Data Loader](/docs/guides/widgets/widget-data-loaders).
This isn't SSR-specific (it works on CSR routes too, avoiding a client-side
fetch waterfall), but it's especially relevant for SSR: a loader is what lets
a public page's real content — not a loading spinner — be present in the
server-rendered HTML.

## Testing SSR locally

- **View Page Source** (not DevTools Elements — that shows the post-hydration
  DOM) and compare it against the equivalent CSR route.
- Disable JavaScript in devtools and reload — universal content should still
  be there; client-only content should show its placeholder, not be broken.
- `curl` the route directly, with a session cookie if the route needs auth:
  ```bash
  curl -sS -c cookies.txt -d '{"email":"...","password":"..."}' \
    -H 'Content-Type: application/json' http://localhost:5173/api/auth/session
  curl -sS -b cookies.txt http://localhost:5173/dashboard | grep 'data-heron-render-mode'
  ```
- `pnpm test:ssr-import` (repo root) — a smoke test asserting the server
  bundle never touches browser globals (`window`, `document`, `localStorage`,
  ...). Run this after adding anything to a widget/service that could
  accidentally assume a browser.
