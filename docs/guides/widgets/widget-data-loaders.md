---
sidebar_position: 9
---

# How to Add a Widget Data Loader

A widget's `server.ts` runs **server-side, before the widget tree is sent to
the browser** — its return value merges into the widget's props. This isn't
SSR-only: it eliminates the client-side "mount, then fetch, then re-render"
waterfall for any widget, CSR or SSR.

## The shape

```ts
// widgets/pages/users/server.ts
import type { ServerContext } from "@heron-ws/app-runtime";

export default async function (ctx: ServerContext) {
  const { token } = ctx.session;
  const { apiBase } = ctx.egret;

  if (!token) return {}; // let the client fetch once the user is authenticated

  const res = await fetch(`${apiBase}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return {}; // don't block the page on a non-200 — let the client handle it

  const json = (await res.json()) as { data?: unknown };
  return { users: Array.isArray(json?.data) ? json.data : [] }; // must be a plain object
}
```

**The return value must be a plain object** — `runWidgetLoaders` only merges
plain objects into props. Returning an array directly is silently ignored;
wrap it in a named key (`{ users: [...] }`), as above.

## Reading it client-side, with a fallback

```ts
// widgets/pages/users/script.ts
const usersScript = ($egret: any, $self: any) => {
  const { users } = $self.getProps() ?? {};
  if (users) {
    renderUsers(users);
  } else {
    // loader returned nothing (no token yet, non-200, or timed out) — fetch client-side
    loadUsersFromApi();
  }
};
```

Always write this fallback. A loader can legitimately return `{}` (no auth
yet), and on SSR routes a slow loader gets abandoned after a timeout — the
widget still has to work without server-provided data.

## Failure isolation

Every loader is wrapped in `Promise.allSettled` with a hard timeout (3s) per
widget:

- **A loader that throws** doesn't break the page — that one widget just
  renders without its props; other widgets' loaders are unaffected. One error
  line gets logged server-side; the browser never sees a 500.
- **A loader that hangs** gets abandoned at the timeout, same outcome.

This means you don't need defensive try/catch in every loader for the
framework's sake — but you should still return `{}` on a handled failure
(bad token, non-200) rather than letting it throw, so you control what the
client fallback sees.

## A real example that skips a full waterfall

`bootstrap_app`'s dashboard loader server-renders task rows directly into
`metadata.json`-bound props, so the content is real HTML on an SSR route even
with JavaScript disabled — not just data waiting for a script to paint it in:

```ts
// widgets/pages/dashboard/server.ts
export default async function loader(ctx: ServerContext) {
  const { token } = ctx.session;
  const apiBase = ctx.egret.apiBase;
  if (!apiBase || !token) return {};

  const res = await fetch(`${apiBase}/api/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return {};

  const tasks = ((await res.json()) as { data?: unknown }).data ?? [];
  return {
    tasks,
    task1Title: tasks[0]?.title ?? "",
    task1Assignee: tasks[0]?.assigneeName ?? "",
    // ...one set of row props per task, bound directly in metadata.json
  };
}
```

## Providing SEO data from a loader

Return a `seoSource` (or explicit `seo`) object alongside your data — see
[Adding SEO to Pages](/docs/guides/ssr/seo) for how it's picked up.

## Need to run logic on demand, not just at render time?

A loader only runs when the page renders. For something a user triggers (a
button click that needs to run server-side, not just read data) — see
[How to Add a Server Action](/docs/guides/widgets/server-actions).
