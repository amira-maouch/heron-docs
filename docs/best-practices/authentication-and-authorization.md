---
sidebar_position: 5
---

# Authentication & Authorization Best Practices

A checklist, not a reference. For how the pieces actually work, start with
[Authentication & Authorization](/docs/guides/backend-and-auth/authentication-and-authorization)
and [Authorization Checks](/docs/guides/backend-and-auth/authorization-checks).

## Always go through the `AuthAdapter`

Never call your backend's login/whoami endpoint directly from a widget,
a custom server route, or an ad hoc fetch buried in a loader. One adapter,
one trust boundary, one place to audit. That centralization is the entire
point of `AuthAdapter` — before it existed, an app could have a credential
reach `loadPermissions()` (or a protected route) without ever being checked
against the backend. Routing around the adapter, even "just this once,"
reopens exactly that gap.

:::warning[Don't hand-roll a parallel check]
If you find yourself writing `if (someHeader) { ... }` anywhere in server
code to approximate "is this user logged in," stop — that logic belongs in
`verify()`, evaluated once, and reused everywhere through `auth`/`can`.
:::

## `verify()` is the one method that matters

It's the only required method on the adapter, and every other feature is
built on top of what it returns. Some rules for it specifically:

- **Never return a principal you haven't actually confirmed.** Decoding a
  JWT's claims without checking a signature/expiry against the backend (or a
  trusted key) is not verification.
- **Return `null`, don't throw**, for an expired, malformed, or revoked
  credential. `null` is "not logged in" — a normal, expected outcome. A
  thrown error becomes a `500` on every request carrying a stale token,
  which is a worse experience than a clean `401`.
- **Keep it cheap.** `verify()` can run on every SSR document, every
  `/api/widgets` and `/api/scripts` request, every server action, and
  `/api/auth/permissions` — Heron resolves it once per request, but "once
  per request" across a whole app is still a lot of calls. Prefer a fast
  backend introspection/whoami endpoint over anything heavy.
- **Don't assume a transport.** The same `verify()` handles both a Bearer
  header and a Heron session cookie — it only ever sees the extracted
  credential string, never how it arrived.

## Choosing `auth` vs `can`

| You need...                                            | Use                     |
| -------------------------------------------------------- | ------------------------ |
| Any logged-in user, no specific permission                | `"auth": true`           |
| To opt a route/node out of an app-wide `auth: true` default | `"auth": false`          |
| A specific business permission (role, grant, capability)  | `"can": { ... }`         |

Never use `{ "action": "*", "subject": "*" }` as a stand-in for "logged in."
That's an administrator-level grant, evaluated against the user's actual
rules — a non-admin verified user will fail it and get a confusing `403`
where you meant `401`.

If most of the app is behind login and only a few routes are public, set the
default once and opt out:

```json
{
  "auth": true,
  "routes": {
    "dashboard": { "widget": "pages/dashboard" },
    "login": { "widget": "pages/login", "auth": false }
  }
}
```

If it's mostly public with a few protected areas, leave the default off and
declare `auth`/`can` only where it's actually needed.

## Only implement `loadPermissions` if you actually have RBAC

It's optional for a reason. Don't add a `loadPermissions` that always
returns `[]` just because an older version of Heron required the method —
that's dead code. Add it the moment (and only the moment) the app declares
its first `can`:

- `pnpm build` enforces the pairing: a `can` anywhere with no
  `loadPermissions` on the adapter fails the build, not a random request in
  production.
- Keep it a **pure mapping** from your backend's shape into Heron
  `AuthorizationRule[]` — no business logic, no "if admin then also grant
  X." Let your backend be the source of truth for what the rules *are*;
  `loadPermissions` only translates the shape.
- An empty rule list is a valid, common result — it means "logged in, no
  grants," not "invalid user." Don't treat `[]` as an error case.
- Heron calls it once per request and reuses the result for every node and
  the route check — you don't need to memoize it yourself.

## Session cookie or Bearer — pick based on who owns login

The rest of the app — `auth`, `can`, `$egret.auth`, `resolveRules` — behaves
identically either way. This is deliberate: authorization logic is decoupled
from how the credential got there.

- **Bearer-only**: the browser or native app already owns login, refresh,
  and token storage (a mobile client, an SPA calling its own backend
  directly). Implement `verify`; skip `session` and `authenticate` entirely.
  This is the right default for most new apps.
- **Heron session cookie**: you want Heron itself to run a traditional
  `POST /api/auth/session` login and manage an HttpOnly cookie. Configure
  `auth.session` and implement `authenticate` alongside `verify`.
- **Hybrid**: configure `auth.session` for browser widgets *and* accept a
  Bearer header from native/API clients — both reach the same `verify()`.

Don't configure `auth.session` "just in case." An app that never calls
`POST /api/auth/session` gets nothing from it but an unused cookie policy —
leave it out until there's an actual login flow that needs it.

## Respect the fail-closed defaults

These are load-bearing, not accidental strictness — don't work around them:

- Don't weaken a `can` to a wildcard to make a check pass. Fix the actual
  rule your backend grants, or use `auth: true` if a permission was never
  the real requirement.
- Don't wrap `verify()`/`loadPermissions()` in a `try/catch` that swallows
  errors to "keep things working." Let a failure return `null`/`[]`
  naturally — that's what makes an outage fail closed (deny) instead of
  fail open (grant).
- There's no supported way to route authorization around the adapter
  (no standalone permissions-loader config) — if that feels like it's
  missing, the logic belongs inside `verify()`/`loadPermissions()` instead.
