---
sidebar_position: 1
title: Using SSR
---

# Using SSR

:::caution Not on `main` yet
SSR ships on the `874-add-ssr-support-to-heron` branch. If your app is built
against `main`, none of this applies yet — see the
[main → SSR migration guide](/docs/migration/main-to-ssr) when you're ready to
move.
:::

## When to use it

Turn SSR on for routes where first-paint speed or crawlability actually
matters — marketing/public pages, anything you want indexed. Leave
internal/authenticated dashboards on CSR unless you have a specific reason;
SSR adds real complexity (see [CSR Placeholders](/docs/guides/ssr/csr-placeholders)).

## Three levels of opt-in

SSR isn't one flag — three levels, each able to override the one above it:

| Level | Where | Meaning |
|---|---|---|
| App | `app.config.ts` → `ssr.enabled` | Is SSR available at all? |
| Route | `app-manifest.json` → route `ssr` | Does this URL override the app default? |
| Widget | `renderMode` on a widget | Can this specific subtree render server-side? |

### App level

```ts
// app.config.ts
ssr: {
  enabled: true,
  abortTimeoutMs: 10_000, // abort a stream that hasn't completed
  cache: {
    publicRoutes: ["/login"],
    maxAgeSeconds: 30,
    maxEntries: 50,
  },
},
```

### Route level

```json
"dashboard": { "widget": "pages/dashboard", "ssr": true },
"csr-only-page": { "widget": "pages/legacy", "ssr": false }
```

Precedence: app `ssr.enabled` gate → explicit route `ssr` → `ssr.default` →
CSR.

## Loading data server-side

Add `server.ts` next to a widget's `metadata.json`:

```ts
// widgets/pages/dashboard/server.ts
export async function loader(ctx: ServerContext) {
  const res = await fetch(`${ctx.egret.apiBase}/api/tasks`, {
    headers: { Authorization: `Bearer ${ctx.session.token}` },
  });
  return { tasks: await res.json() };
}
```

The result gets shallow-merged into the widget's props before render. Read it
client-side with a fallback for when SSR didn't run:

```ts
// script.ts
const { tasks } = $self.getProps() ?? {};
if (tasks) renderTasks(tasks);
else await loadTasksFromApi(); // CSR fallback
```

Loaders get a 3s timeout — if a loader is slow, the page still renders
without its data rather than hanging the response.

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
