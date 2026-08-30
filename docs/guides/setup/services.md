---
sidebar_position: 3
---

# Services

A service is an app-wide singleton reachable from any widget script via
`$egret.getService(name)` — a backend client is the most common example, but
the mechanism is generic. Like [registry components](/docs/guides/setup/vendor-a-registry-component),
services are published in a registry and vendored into your app; unlike
components, you also have to explicitly initialize one with config before
it's usable.

## 1. Vendor it in `bundle-manifest.json`

```json
{
  "registries": {
    "egret-ui": "https://registry.heron.ws/api/registries/egret-ui"
  },
  "services": { "egret-ui/core/egret-client": "*" }
}
```

Same mechanism as vendoring a component — the resolved version gets pinned
into `.bundle-lock.json` on build. See
[How to Add a Component to the Registry](/docs/guides/setup/vendor-a-registry-component)
for the full vendoring model (registries, coverage rules).

## 2. Initialize it, once, in a middleware

Vendoring makes the service's *factory* available; your app still owns
constructing it with real config. Do this once, in a
[middleware](/docs/guides/setup/how-to-create-a-middleware) — real example:

```ts
// middlewares/services.ts
// @Middleware({ target:"page", stage:"route_matched", priority:100 })
const initServices = async (_context: any, next: any, _block: any) => {
  try {
    $egret.initService("egretClient", {
      apiBaseUrl: $egret.getEnv("EGRET_API_BASE_URL"),
    });
  } catch (e) {
    console.error("[services] failed to initialize egret-client:", e);
  }
  await next();
};
```

`initService(name, config)` is idempotent — safe to call on every navigation.
Give this middleware a **higher** priority number than anything that depends
on the service being ready (in this codebase's convention, higher priority
numbers run first).

## 3. Use it in a script

```ts
const client = $egret.getService("egretClient");
if (!client) return; // not initialized yet, or vendoring/config issue

await client.listDocuments("contracting.contract", { pageLength: 20 });
```

`$egret.hasService(name)` lets you check availability without triggering a
`getService` call on something that might not be ready.

## Worked example: `egretClient`, a backend service

`egretClient` is exactly this pattern applied to talking to your backend:
vendored via `bundle-manifest.json` (`egret-ui/core/egret-client`),
initialized once with `apiBaseUrl` from an env var, then called from any
widget script with `runCommand`/`runQuery`/`listDocuments`/etc. See
[How to Wire Heron to an Egret Backend](/docs/guides/backend-and-auth/how-to-wire-egret-backend)
for its full API surface — this guide covers the general services mechanism
that `egretClient` happens to be the most common instance of.

## Not what you need?

- One-off server-side logic triggered by a user action →
  [How to Add a Server Action](/docs/guides/widgets/server-actions).
- Data needed before first render, not on-demand →
  [How to Add a Widget Data Loader](/docs/guides/widgets/widget-data-loaders).
