---
sidebar_position: 12
---

# Authorization Checks

:::info No `<Can>` component
If you're looking for a `<Can>` JSX wrapper — it doesn't exist in Heron.
Authorization is a declarative `"can"` property on metadata nodes, plus an
imperative `$egret.auth` / `$self.can()` API. This page covers the real
mechanism.
:::

## Gating a node declaratively

Add `"can"` to any node in `metadata.json` or any route in
`app-manifest.json`. A node/route failing the check is **pruned from the
tree** entirely — not hidden with CSS, not conditionally rendered, just not
there.

```json
{
  "component": "egret:core:div",
  "id": "purge-btn",
  "can": { "action": "command", "subject": "users.purge" },
  "props": { "className": "btn btn-outline-danger btn-sm" }
}
```

`{ action: "*", subject: "*" }` is the convention for "admin only".

### `any` / `all`

```json
"can": {
  "any": [
    { "action": "read", "subject": "User" },
    { "action": "command", "subject": "users.invite" }
  ]
}
```

`any` = OR, `all` = AND.

## Gating a whole route

```json
"users": {
  "widget": "pages/users",
  "can": { "any": [{ "action": "read", "subject": "User" }] }
}
```

## Checking imperatively, in a script

```ts
if ($self.can("command", "users.purge")) {
  // show/do the thing
}

// row-level: does the user have "read" on THIS specific record?
const canReadRow = $egret.auth.can("read", "Task", taskRow);
```

`$egret.auth` also exposes:

```ts
$egret.auth.cannot(action, subject);          // inverse of can()
$egret.auth.canAny([{ action, subject }, ...]);
$egret.auth.canAll([{ action, subject }, ...]);
$egret.auth.getPermission(action, subject);     // the matching rule, or undefined
```

## Filtering a list by row-level conditions

Real pattern, `bootstrap_app`'s dashboard — combine a fetched list with the
matching rule's conditions:

```ts
function filterTasksByRule(tasks, rule, auth) {
  if (!rule) return [];
  if (rule.conditions == null) return tasks; // unconditional grant
  return tasks.filter((t) => auth.can("read", "Task", t));
}
```

## Important: fails closed

`$egret.auth.can()` returns `false` while permissions are still loading, not
`true`. Don't gate a loading spinner behind a `can()` check — it'll never show
correctly before permissions arrive.
