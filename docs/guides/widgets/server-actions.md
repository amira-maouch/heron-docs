---
sidebar_position: 10
---

# How to Add a Server Action

A server action is server-only logic a widget can call **on demand** (a
button click, a form submit) — unlike a [data loader](/docs/guides/widgets/widget-data-loaders),
which only runs once, at render time.

## 1. Declare it in `server.ts`

```ts
// widgets/pages/settings/server.ts
import { defineActions, type ActionContext } from "@heron-ws/app-runtime/server-actions";

export const actions = defineActions({
  updateProfile: {
    args: {
      name: { type: "string", required: true, minLength: 1, maxLength: 80 },
    },
    can: { action: "*", subject: "*" },
    rateLimit: { windowMs: 60_000, max: 10 },
    async fn(ctx: ActionContext<{ name: string }>) {
      const user = ctx.getUser();
      if (!user) throw new Error("not authenticated");

      const res = await ctx.fetchApi("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ctx.args.name }),
      });
      if (!res.ok) throw new Error("profile update failed");

      const profile = ((await res.json()) as { data?: Record<string, unknown> }).data ?? {};
      return { profileName: profile.name ?? ctx.args.name };
    },
  },
});
```

- `args` — a small typed schema (`string`/`number`/`boolean`/`object`/`array`/`null`,
  with `required`, length/range bounds, `enum`) validated **before** `fn`
  runs. Reject bad input here, not inside `fn`.
- `can` — an extra permission check on top of whatever the route/widget
  already gates. See [Authorization Checks](/docs/guides/backend-and-auth/authorization-checks).
- `rateLimit` — `{ windowMs, max }`, enforced server-side automatically.
- `fn` gets an `ActionContext`: everything `ServerContext` has (`session`,
  `egret.apiBase`, ...) plus `ctx.args` (validated input), `ctx.getUser()`,
  `ctx.getCookie(name)`, `ctx.fetchApi(path, init)` (pre-configured to your
  backend), and `ctx.navigate(href)` for a server-driven redirect.

Action names must be valid identifiers and can't collide with reserved names
(`loader`, `default`, `constructor`, ...).

## 2. Call it from `script.ts`

```ts
// widgets/pages/settings/script.ts
const settingsScript = (_egret: any, $self: any) => {
  $self.getChild("@saveProfileBtn")?.listen({
    onClick: async () => {
      const name = $self.getChild("@form-name-value")?.getProps()?.value ?? "";
      try {
        const result = await $self.actions.updateProfile({ name });
        $self.setProps({ profileName: result.profileName });
      } catch (error) {
        console.error("[settings] updateProfile failed", error);
      }
    },
  });
};
export default settingsScript;
```

`$self.actions.<name>(input)` is generated automatically from whatever you
declared in `server.ts` — there's nothing to import or register on the client
side. Calling an action name that isn't declared throws immediately
(`ACTION_NOT_FOUND`), before any network request.

## What's handled for you

- **CSRF**: every `$self.actions.*` call automatically sends the required
  header — nothing to add in `script.ts`.
- **Rate limiting**: enforced server-side from the `rateLimit` you declared —
  no client-side throttling needed.
- **Auth**: `ctx.fetchApi(...)` and `ctx.getUser()` use the same session as
  the rest of the request; you don't re-implement token handling per action.

## When to use this vs. a data loader vs. calling `egretClient` directly

| | Runs when | Use for |
|---|---|---|
| [Data loader](/docs/guides/widgets/widget-data-loaders) | Once, at render | Pre-fetching what the page needs to show |
| Server action | On demand (click, submit) | A mutation that must run server-side (server-only secrets, `can` re-checked server-side, rate-limited) |
| [`egretClient` from `script.ts`](/docs/guides/backend-and-auth/how-to-wire-egret-backend) | On demand, client-side | Everything else — most reads and writes just call your backend directly |
