---
sidebar_position: 16
---

# Authentication & Authorization

Two real setups exist across our apps — pick based on whether you need
server-side auth enforcement (SSR, cookie sessions) or a simpler client-side
setup is enough.

## Option A — Direct, client-side (CSR-only apps)

What `alefbab_app` does: no `authorization` block in `app.config.ts` at all.
Tokens live in `localStorage`; a middleware guards navigation and talks
straight to the backend's built-in auth endpoints through `egretClient`.

```ts
// middlewares/auth.ts
// @Middleware({ target:"page", stage:"route_matched", priority:10 })
const authGuard = async (context: any, next: any, block: any) => {
  if (PUBLIC_PAGES.has(context.pageName)) { await next(); return; }
  let valid = hasFreshAccessToken();
  if (!valid) valid = await tryRefreshToken();
  if (!valid) { block("Not authenticated", "/login"); return; }
  await next();
};

async function tryRefreshToken(): Promise<boolean> {
  const client = $egret.getService("egretClient");
  const res = await client.call(
    "authentication.get_refreshed_token",
    { kind: "query", method: "POST", public: true },
    { refresh_token: localStorage.getItem("auth_refresh_token") },
  );
  if (!res.ok) return false;
  localStorage.setItem("auth_token", res.data.access_token);
  return true;
}
```

Simple, no server-side enforcement — fine for CSR-only apps where the API
itself is the real authorization boundary.

## Option B — `AuthAdapter` (SSR apps, cookie sessions, custom backends)

### When you actually need this

An `AuthAdapter` is a **centralized, server-safe bridge** between Heron's
server and your real backend — `authenticate()`, `verify()`, `revoke()`, and
`loadPermissions()`.

The reason it's necessary once you have real permissions/roles: a Heron app
doesn't just render a page once — the server also handles the requests that
fetch widgets, scripts, and actions on their own (see
[App Structure](/docs/heron/app-structure) and
[How to Add a Server Action](/docs/guides/server-actions)). For `can` to
correctly prune a widget tree or protect a server action, **the server**
needs to know who's asking and what they're allowed to do — not just the
browser. Option A's client-side token (stored in `localStorage`) never
reaches the server, so it can't power server-side `can` enforcement. If your
app has more than one role or any real permission model, use `AuthAdapter` so
`can` is actually enforced where it matters, not just used to hide UI.

What `bootstrap_app` does: `app.config.ts` points at an adapter file, and the
framework handles cookie sessions, SSR-side verification, and permission
loading around it.

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

The adapter implements four methods — this example wires to a **non-Egret**
REST backend:

```ts
// authorization/auth-adapter.ts
const authAdapter: AuthAdapter = {
  async authenticate(credentials) {
    const res = await fetch(`${apiBase()}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    // ... return { credential, principal, expiresAt }
  },
  async verify(credential) { /* GET /api/auth/me */ },
  async revoke(credential) { /* POST /api/auth/logout */ },
  async loadPermissions(identity) {
    const raw = await loadBackendPermissions(identity.credential);
    return adaptPermissions(raw); // map to Heron's { action, subject, conditions? } shape
  },
};
```

The permission mapper translates your backend's native grant format into
Heron's rule shape — including row-level (`"own"`) conditions:

```ts
function grantToRule(grant: string, userId?: string): AuthorizationRule {
  if (grant === "*") return { action: "*", subject: "*" };
  const ownMatch = /^([^:]+):([^:]+):own$/.exec(grant);
  if (ownMatch) {
    const [, action, subject] = ownMatch;
    return { action, subject, conditions: { [OWNER_FIELD[subject]]: userId } };
  }
  const [action, subject] = grant.split(":");
  return { action, subject };
}
```

To wire the adapter to the **Egret backend** itself instead, `authenticate`/
`verify`/`revoke` call the same `authentication.*` commands/queries shown in
Option A (via `egretClient`) rather than a custom REST API — everything else
about the adapter contract stays the same.

## Which one to use

| | Option A (direct) | Option B (`AuthAdapter`) |
|---|---|---|
| SSR routes | No | Yes |
| Server-enforced auth | No (client-only guard) | Yes (cookie verified server-side) |
| Setup effort | Low | Higher, but framework-managed |

Once permissions are loaded (either option), gate UI with `$egret.auth` — see
[Authorization Checks](/docs/guides/authorization-checks).
