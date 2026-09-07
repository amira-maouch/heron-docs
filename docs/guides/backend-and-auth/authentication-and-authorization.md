---
sidebar_position: 2
---

# Authentication & Authorization

Heron uses one simple trust rule:

> Your app may obtain a credential however it wants. When that credential
> reaches Heron, Heron asks the configured server auth adapter to verify it
> before trusting the user or loading permissions.

This matters because Heron serves more than browser UI. The server also serves
widget metadata, widget scripts, SSR documents, widget loaders, server actions,
and permission rules. A browser-only login check cannot protect those things.

## The three ideas

- A **credential** is the secret sent by the client, usually an access token.
- **Authentication** answers “Who owns this credential?” It is implemented by
  `AuthAdapter.verify()`.
- **Authorization** answers “What may this verified user do?” It is implemented
  by `AuthAdapter.loadPermissions()` and evaluated by Heron's `can` checks.

An empty permission list does not make a user invalid. It means the user is
logged in but has no explicit RBAC grants.

## Public, authenticated, and permission-protected content

These are deliberately different:

| Declaration | Meaning | Failed request |
|---|---|---|
| No `auth`, no `can` | Public | Continues anonymously |
| `"auth": true` | Any verified user | `401 Unauthorized` |
| `"can": { ... }` | A verified user with the matching rule | `401` if not logged in; `403` if logged in but not allowed |

Do not use `{ "action": "*", "subject": "*" }` to mean “any logged-in
user.” That check asks whether the user's rules grant the wildcard permission,
which is normally an administrator-level grant. Use `"auth": true` instead.

You can set a default for the whole manifest and make public routes opt out:

```json
{
  "auth": true,
  "routes": {
    "dashboard": { "widget": "pages/dashboard" },
    "login": { "widget": "pages/login", "auth": false },
    "landing": { "widget": "pages/landing", "auth": false },
    "users": {
      "widget": "pages/users",
      "can": { "action": "read", "subject": "User" }
    }
  }
}
```

`auth` may also be placed on a metadata node or a server action. `can` remains
the right choice when a specific business permission is required.

## Configure the server adapter

```ts
// app.config.ts
authorization: {
  enabled: true,
  tokenKey: "auth_token",
  unauthorizedPath: "/unauthorized",
  auth: {
    adapter: "./authorization/auth-adapter.ts",
    loginPath: "/login",
    returnToParam: "returnTo",
  },
},
```

When authorization is enabled, the adapter must implement `verify()`. Heron
fails closed if the adapter is missing or invalid. There is no separate
`authorization.permissions.loader` path that can bypass credential
verification.

```ts
interface AuthAdapter {
  verify(
    credential: string,
    context: AuthRequestContext,
  ): Promise<VerifiedIdentity | null>;

  loadPermissions?(
    identity: VerifiedIdentity,
    context: AuthRequestContext,
  ): Promise<AuthorizationRule[]>;

  authenticate?(
    credentials: unknown,
    context: AuthRequestContext,
  ): Promise<AuthenticationResult | null>;

  revoke?(
    credential: string,
    context: AuthRequestContext,
  ): Promise<void>;
}
```

The only required method is:

- `verify`: send the credential to the real backend (or verify it using the
  backend's trusted key). Return `null` if it is expired, revoked, malformed,
  or otherwise invalid.

Everything else is optional:

- `loadPermissions`: use the already verified identity to fetch and map the
  user's grants into Heron `AuthorizationRule[]`. Returning `[]` is valid.
  **Omit it entirely if the app has no RBAC** — only `auth: true`/`auth: false`
  boundaries. A verified identity then simply has no rules: `auth: true` still
  passes for any logged-in user, and any `can` check (if you add one later)
  fails closed until you implement this. `pnpm build` rejects an app that
  declares `can` anywhere without a `loadPermissions` to back it, so the
  mismatch surfaces before deploy, not as an always-403 in production.
- `authenticate`/`revoke`: only for Heron-managed browser sessions (see
  below).

## Bearer credentials are automatic

Heron automatically reads this header:

```http
Authorization: Bearer <access-token>
```

It then calls `AuthAdapter.verify(<access-token>)`. The raw token is not trusted
and permissions are not loaded unless verification succeeds.

This is the normal mode for an app such as AlefBab:

```text
login / refresh / logout  -> browser egretClient -> backend
Heron API request         -> Bearer token -> adapter.verify()
permission check          -> verified identity -> adapter.loadPermissions()
cookies                   -> disabled
```

The browser continues to own its login experience and token storage. Heron owns
the server trust boundary.

If both a Bearer header and a Heron session cookie are present, Bearer wins.
An invalid Bearer credential does not silently fall back to the cookie. This
keeps one request from accidentally changing identities.

## Cookie sessions are opt-in

Add `auth.session` only when you want Heron to manage an HttpOnly cookie:

```ts
authorization: {
  enabled: true,
  auth: {
    adapter: "./authorization/auth-adapter.ts",
    session: {
      cookie: {
        name: "bootstrap_session",
        lifetimeSeconds: 1800,
        sameSite: "lax",
        secure: "auto",
      },
    },
    loginPath: "/login",
  },
},
```

Cookies are created only when all three statements are true:

1. `auth.session` is configured.
2. The adapter implements `authenticate()`.
3. The app calls `POST /api/auth/session`.

The session endpoints are:

| Endpoint | Behavior |
|---|---|
| `POST /api/auth/session` | Calls optional `authenticate()` and creates the configured HttpOnly cookie |
| `GET /api/auth/session` | Verifies the cookie with `verify()` and returns browser-safe identity data |
| `DELETE /api/auth/session` | Calls optional `revoke()` and clears the cookie |
| `GET /api/auth/permissions` | Verifies Bearer/cookie credential, then calls `loadPermissions()` |

Without `auth.session`, the session endpoint is disabled and no Heron auth
cookie is created.

> A top-level `auth.cookie` (no `session` wrapper) is a **deprecated** 1.x
> key. Heron still reads it as a fallback when `auth.session` is absent — with
> a `console.warn` — so an app that hasn't migrated keeps its cookie. Move it
> under `auth.session.cookie` when convenient; see the migration guide.

## Three supported modes

### Bearer-only

Use this when the browser or native app already logs in with a backend client.
Implement `verify`; omit `session` and `authenticate`. Add `loadPermissions`
only once the app has RBAC `can` checks — an `auth: true`/`auth: false`-only
app like AlefBab doesn't need it.

### Heron session

Use this when login should go through `POST /api/auth/session`. Configure
`auth.session` and implement `authenticate` and `verify`. Add `loadPermissions`
if the app uses `can`; implement `revoke` if the backend supports revocation.

### Hybrid

Configure `auth.session`, while also allowing native or API clients to send a
Bearer header. Both transports reach the same `verify()` method.

## Why a server adapter cannot use `$egret.getService()`

`$egret.getService("egretClient")` exists inside the browser runtime. When the
Heron server must verify a request:

- `$egret` does not exist.
- Registry services have not been installed.
- There is no browser or `localStorage`.
- The caller may be SSR, a native app, or an API client.

The reusable code belongs below the browser service layer:

```text
@egret/client
    |-- browser registry service: $egret.getService("egretClient")
    `-- server Egret auth adapter
```

Egret-backed apps write the adapter directly against `EgretClient` — there is
no separate Heron-maintained factory package, so each app owns this file and
can shape it however it needs:

```ts
// authorization/auth-adapter.ts
import { EgretClient } from "@egret/client/client";
import type { AuthAdapter } from "@heron-ws/app-runtime";

const apiBaseUrl = process.env.EGRET_API_BASE_URL!;

const adapter: AuthAdapter = {
  async verify(credential) {
    const client = new EgretClient({ apiBaseUrl, getToken: () => credential });
    const result = await client.call("authentication.get_user_information", {
      kind: "query",
    });
    if (!result.ok) return null;
    const user = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!user || typeof user !== "object") return null;
    return { credential, principal: toPrincipal(user) };
  },

  // Optional until this app introduces Heron `can` declarations.
  async loadPermissions(identity) {
    const client = new EgretClient({
      apiBaseUrl,
      getToken: () => identity.credential,
    });
    const result = await client.call("authorization.my_permissions", {
      kind: "query",
    });
    if (!result.ok) return [];
    return mapBackendRules(result.data, identity.principal);
  },
};

export default adapter;
```

This adapter verifies a Bearer token through
`authentication.get_user_information`. Omitting `loadPermissions` entirely is
just as valid — it supports `auth: true` while any `can` check (if you add one
later) fails closed until you implement it. The browser registry service and
server adapter share the same canonical `@egret/client`; they do not share a
browser runtime instance.

## Request outcomes in plain English

- No credential on public content: continue as a guest.
- Invalid credential on public content: continue as a guest; never trust it.
- No or invalid credential on `auth: true`/`can` content: return `401`.
- Valid credential with `loadPermissions() === []` on `auth: true`: allow.
- Valid credential with no matching rule on `can` content: return `403`.
- Valid credential with a matching rule: allow.

For rule declarations and imperative checks, continue with
[Authorization Checks](/docs/guides/backend-and-auth/authorization-checks). For
a practical checklist — when to use `auth` vs `can`, when `loadPermissions` is
actually worth implementing, cookie vs Bearer — see
[Authentication & Authorization Best Practices](/docs/best-practices/authentication-and-authorization).
