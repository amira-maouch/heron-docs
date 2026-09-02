---
sidebar_position: 2
---

# Authentication & Authorization

## Why this exists

A Heron app isn't just a page that renders once — the server independently
handles `/api/widgets`, `/api/scripts`, `/api/components`, every `server.ts`
loader, and every [server action](/docs/guides/widgets/server-actions). For
`can` to actually protect any of that (not just hide a button), **the server**
needs to know who's asking, on every one of those requests — not only the
browser.

That's harder than it sounds, because a login widget's own authentication
request is invisible to the server. `script.ts` is a browser-only bundle —
it never runs during SSR or when the server handles a widget/script/action
request — so if a login page logs a user in by calling your backend directly
from `script.ts`, the server has no way to know that happened. There's
nothing to check on the next server-side request.

The `AuthAdapter` is Heron's fix for this: **one centralized, server-side
bridge** between Heron and whatever your real backend is —
`authenticate()`, `verify()`, `revoke()`, `loadPermissions()`. Heron owns an
HttpOnly session cookie (invisible to `script.ts`, sent automatically on
every request, including SSR); your backend owns credential persistence,
expiry, and revocation. The adapter is only the translation layer between
them — so instead of a widget calling your backend directly, it calls two
**fixed, backend-agnostic** Heron endpoints:

| Endpoint | Calls this adapter method |
|---|---|
| `POST /api/auth/session` | `authenticate(credentials)` |
| `GET /api/auth/session` | `verify(credential)` |
| `DELETE /api/auth/session` | `revoke(credential)` |
| `GET /api/auth/permissions` | `loadPermissions(identity)` |

Because every app talks to the *same* two endpoints regardless of backend,
Heron itself never needs to know what your backend looks like — the adapter
is the only place that does. `loadPermissions()` is where you map whatever
shape your backend's permissions come in (roles, groups, grant strings,
anything) into Heron's own `{ action, subject, conditions? }` rule shape,
however makes sense for your data. That mapping is exactly what keeps Heron
apps backend-agnostic — nothing about `can` is Egret-specific.

## Wiring it in

```ts
// app.config.ts
authorization: {
  enabled: true,
  tokenKey: "auth_token",
  unauthorizedPath: "/unauthorized",
  auth: {
    adapter: "./authorization/auth-adapter.ts",
    cookie: { name: "bootstrap_session", lifetimeSeconds: 1800, sameSite: "lax" },
    loginPath: "/login",
  },
},
```

## The adapter's four functions

```ts
// authorization/auth-adapter.ts
import type { AuthAdapter } from "@heron-ws/app-runtime";

const authAdapter: AuthAdapter = { authenticate, verify, revoke, loadPermissions };
export default authAdapter;
```

| Function | Called when | Returns |
|---|---|---|
| `authenticate(credentials, ctx)` | A widget `POST`s `/api/auth/session` to log in | `{ credential, principal, expiresAt, browserToken? }` or `null` |
| `verify(credential, ctx)` | Any request needs to check an existing session (SSR, `GET /api/auth/session`) | `{ credential, principal, expiresAt }` or `null` |
| `revoke(credential, ctx)` | A widget `DELETE`s `/api/auth/session` to log out | `void` |
| `loadPermissions(identity, ctx)` *(optional)* | `GET /api/auth/permissions`, or before a `can`-gated SSR render | An array of Heron `AuthorizationRule`s |

Real example, `bootstrap_app` (wires to its own bespoke REST API):

```ts
async authenticate(credentials) {
  const res = await fetch(`${apiBase()}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  if (!res.ok) return null;
  const { accessToken, user, expiresAt } = (await res.json()).data;
  return { credential: accessToken, browserToken: accessToken, principal: toPrincipal(user), expiresAt };
},
async verify(credential) {
  const res = await fetch(`${apiBase()}/api/auth/me`, { headers: { authorization: `Bearer ${credential}` } });
  if (!res.ok) return null;
  const user = (await res.json()).data;
  return { credential, principal: toPrincipal(user), expiresAt: user.expiresAt };
},
async revoke(credential) {
  await fetch(`${apiBase()}/api/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${credential}` } });
},
async loadPermissions(identity) {
  return adaptPermissions(await loadBackendPermissions(identity.credential));
},
```

`authenticate`/`loadPermissions` look meaningfully different depending on
your backend — see real, complete implementations for two different kinds of
backend in [Authenticate Examples](/docs/guides/backend-and-auth/auth-adapter/authenticate-examples)
and [loadPermissions Examples](/docs/guides/backend-and-auth/auth-adapter/load-permissions-examples).

## What a widget actually calls

Never call your backend's login endpoint directly from a widget — call
Heron's fixed session endpoint instead, so the server-side HttpOnly cookie
gets set. Real example, `bootstrap_app`'s login widget:

```ts
// widgets/pages/login/script.ts
const res = await fetch("/api/auth/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
  body: JSON.stringify({ userId }),
});
const { data } = await res.json();
// data.principal, data.browserToken (only ever returned to script.ts,
// never included in SSR bootstrap state)

// Permissions load through the SAME adapter, via the fixed endpoint —
// not by asking the backend directly:
const rulesRes = await fetch("/api/auth/permissions", {
  headers: { Authorization: `Bearer ${data.browserToken}` },
});
```

## When you don't need any of this

If your app is CSR-only with no `server.ts` loaders, no server actions, and
no SSR routes — there's nothing server-side for `can` to protect, so an
`AuthAdapter` mostly buys you nothing. `alefbab_app` skips it entirely: no
`authorization` block in `app.config.ts`, a token in `localStorage`, and a
middleware that guards client-side navigation only.

```ts
// middlewares/auth.ts
// @Middleware({ target:"page", stage:"route_matched", priority:10 })
const authGuard = async (context: any, next: any, block: any) => {
  if (PUBLIC_PAGES.has(context.pageName)) { await next(); return; }
  if (!(await hasValidToken())) { block("Not authenticated", "/login"); return; }
  await next();
};
```

| | No adapter (client-only) | `AuthAdapter` |
|---|---|---|
| SSR routes | No | Yes |
| Server-enforced `can` | No — hides UI only | Yes |
| Setup effort | Low | Higher, framework-managed |

Once permissions are loaded (either way), gate UI and server logic with
`$egret.auth` — see
[Authorization Checks](/docs/guides/backend-and-auth/authorization-checks).
