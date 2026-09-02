---
sidebar_position: 1
---

# `authenticate()` Examples

Two real, complete implementations — a bespoke REST backend, and an
Egret-style backend. The contract is identical either way: take whatever
`POST /api/auth/session` sent as its body, return
`{ credential, principal, expiresAt, browserToken? }` on success or `null`
on failure.

## Against a bespoke REST backend

`bootstrap_app` — a plain JSON REST API with its own login/me/logout routes:

```ts
// authorization/auth-adapter.ts
type BackendUser = { id: string; name?: string; role?: string; expiresAt?: number };

function apiBase(): string {
  return (process.env.EGRET_FAKE_API_URL || "http://localhost:4001").replace(/\/+$/, "");
}

function principalFromUser(user: BackendUser): AuthPrincipal {
  return { key: user.id, id: user.id, ...(user.name && { name: user.name }), ...(user.role && { role: user.role }) };
}

async authenticate(credentials) {
  const response = await fetch(`${apiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials ?? {}),
  });
  if (!response.ok) return null;

  const payload = await response.json();
  const { accessToken, expiresAt, user } = payload.data ?? {};
  if (payload.success !== true || !accessToken || !user?.id || typeof expiresAt !== "number") {
    return null;
  }

  return {
    credential: accessToken,
    // Compatibility for direct browser-to-backend script.ts calls.
    // New scripts should use $egret.auth.getAccessToken() instead.
    browserToken: accessToken,
    principal: principalFromUser(user),
    expiresAt,
  };
},
```

Whatever `credentials` shape a widget sends to `POST /api/auth/session`
arrives here unchanged — this backend expects `{ userId }` in its demo login
flow, but the adapter itself doesn't care what shape it is, it just forwards
the body to `/api/auth/login`.

## Against an Egret-style backend

`doubleguard-crm` — talks to Egret's own `authentication.*` query/command
endpoints directly via `fetch`, with a JWT as the credential (no session
lookup needed — the expiry is decoded straight out of the token):

```ts
// authorization/auth-adapter.ts
import { Buffer } from "node:buffer";

type LoginCredentials = { email: string; password: string; totp_code?: string };

function apiBase(): string {
  return (process.env.EGRET_AUTH_BASE_URL || process.env.EGRET_API_BASE_URL || "").replace(/\/+$/, "");
}

function jwtExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getToken(credentials: LoginCredentials): Promise<string | null> {
  const res = await fetch(`${apiBase()}/public/authentication/query/get_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) return null;
  const row = unwrapRow((await res.json()));
  if (!row || row.mfa_required === true) return null;
  return row.access_token ?? null;
}

async authenticate(rawCredentials) {
  const credentials = rawCredentials as Partial<LoginCredentials>;
  if (typeof credentials.email !== "string" || typeof credentials.password !== "string") {
    return null;
  }

  const accessToken = await getToken({ email: credentials.email.trim(), password: credentials.password });
  if (!accessToken) return null;

  const expiresAt = jwtExpiresAt(accessToken);
  const user = await getUser(accessToken); // GET authentication/query/get_user_information
  if (!user || !expiresAt || expiresAt <= Date.now()) return null;

  return { credential: accessToken, browserToken: accessToken, principal: principalFromUser(user), expiresAt };
},
```

Note this one calls Egret's `/public/authentication/query/get_token` and
`authentication/query/get_user_information` **directly with `fetch`**, not
through `$egret.getService("egretClient")` — the adapter runs entirely on
the server (Node), separate from the browser-side service that
[middlewares initialize](/docs/guides/setup/services); it doesn't have
access to it and doesn't need to.

## MFA / multi-step login

Both real examples above return `null` outright when the backend reports
`mfa_required`/an incomplete login — from the adapter's point of view that's
just "authentication failed," and the login *widget* is responsible for
showing a second step (TOTP code, recovery code) and retrying
`authenticate()` with the completed credentials. The adapter itself stays a
single-step function; multi-step UX lives entirely client-side in the widget
script.
