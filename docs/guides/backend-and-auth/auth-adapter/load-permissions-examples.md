---
sidebar_position: 2
---

# `loadPermissions()` Examples

`loadPermissions(identity)` maps whatever shape your backend's permissions
come in into Heron's rule shape: `{ action: string, subject: string,
conditions?: unknown }`. Two real, differently-shaped backends — grant
strings, and group membership.

## Grant strings → rules (with row-level conditions)

`bootstrap_app`'s backend hands back a flat list of `"action:subject"`
strings (or `"*"` for everything, or `"action:subject:own"` for row-scoped
access). Split into two files on purpose — one that fetches (I/O, knows
nothing about Heron), one that maps (pure, no I/O):

```ts
// authorization/permissions-loader.ts — I/O only
export type RawPermissions = { grants: string[]; userId?: string };

export async function loadPermissions(token: string | null): Promise<RawPermissions> {
  if (!token) return { grants: [] };
  const res = await fetch(`${apiBase()}/api/authorization/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { grants: [] };
  const json = await res.json();
  return {
    grants: Array.isArray(json?.data?.grants) ? json.data.grants : [],
    userId: json?.data?.userId,
  };
}
```

```ts
// authorization/permissions-adapter.ts — pure mapping, no I/O
const OWNER_FIELD_BY_SUBJECT: Record<string, string> = { Task: "assigneeId" };

function grantToRule(grant: string, userId?: string): AuthorizationRule {
  if (grant === "*") return { action: "*", subject: "*" };

  // "read:Task:own" → scope to a condition, not a static rule
  const ownMatch = /^([^:]+):([^:]+):own$/.exec(grant);
  if (ownMatch) {
    const [, action, subject] = ownMatch;
    const ownerField = OWNER_FIELD_BY_SUBJECT[subject] ?? "ownerId";
    return { action, subject, conditions: { [ownerField]: userId ?? null } };
  }

  const idx = grant.indexOf(":");
  return idx === -1
    ? { action: grant, subject: "*" }
    : { action: grant.slice(0, idx), subject: grant.slice(idx + 1) };
}

export function adaptPermissions(raw: RawPermissions): AuthorizationRule[] {
  return (raw?.grants ?? []).map((grant) => grantToRule(grant, raw?.userId));
}
```

```ts
// authorization/auth-adapter.ts — composes the two
async loadPermissions(identity) {
  const raw = await loadBackendPermissions(identity.credential);
  return adaptPermissions(raw);
},
```

The `"own"` handling is the interesting part: the backend hands out the
**same static grant** (`"read:Task:own"`) to every principal with a given
role — it's `permissions-adapter.ts` that turns it into a caller-specific
rule, using `raw.userId` (the caller's own id, which the loader got back
from the backend alongside the grants). Two different users with the same
role end up with the same *grant* but different *rules* — one scoped to
`{ assigneeId: "alice" }`, the other to `{ assigneeId: "bob" }` — which is
exactly why each only ever sees their own rows.

## Group membership → rules (no row-level conditions)

`doubleguard-crm`'s backend has no per-action grant list at all — just group
membership. The mapping is coarser: check which groups the user belongs to,
return a fixed rule set per group:

```ts
// authorization/auth-adapter.ts
async loadPermissions(identity) {
  const groups = await getUserGroups(identity.credential); // GET authentication/query/get_user_groups

  if (groups.includes("System Manager")) {
    return [{ action: "all", subject: "all" }];
  }

  return groups.includes("salesmen")
    ? [{ action: "access", subject: "DashboardPage" }]
    : [];
},
```

No `permissions-loader`/`permissions-adapter` split here — this backend's
shape is simple enough that fetching and mapping fit in one function. Split
yours the way `bootstrap_app` does once the mapping logic itself is doing
enough (regexes, per-subject lookup tables) to be worth testing on its own.

## Picking a shape for your own backend

- **Backend already thinks in fine-grained actions** (a grant/permission
  list, one entry per action+subject) → the grant-string mapper pattern.
- **Backend only thinks in roles/groups** → the group-membership pattern —
  simpler, but coarser; you can't express "can edit *your own* records" this
  way without extra backend support.
- **Row-level access** (`"own"`, or anything scoped to a specific record) is
  always the adapter's job, expressed via `conditions` — never bake it into
  a static rule, or every user ends up with the same access.

`conditions` is intentionally untyped — `can(action, subject, resource)`
matches a plain object automatically, but nothing stops an adapter from
returning a different shape (an id list, an array) that a widget script
reads back itself via `$egret.auth.getPermission()` and interprets. See
[Authorization Checks](/docs/guides/backend-and-auth/authorization-checks)
for how `can`/`conditions` get consumed.
