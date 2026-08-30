---
sidebar_position: 4
---

# How to Create a Middleware

Middlewares in `middlewaresDir` (set in `app.config.ts`) run on the
**browser-side page lifecycle** — before a page renders on navigation. This is
not an HTTP/Express middleware; it's a client-side navigation guard.

:::info Two different "middleware" concepts
Heron also has SSR-side Express middleware (for the production HTML
document). That's unrelated and covered in [Using SSR](/docs/guides/ssr/using-ssr).
This guide is about the page-lifecycle kind, in your app's `middlewares/` folder.
:::

## The shape

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

- The `@Middleware(...)` annotation **must be the leading comment directly
  above the `const`**. A build-time transform scans for this exact pattern
  and registers the handler — anything else (a helper `function` declared
  between the comment and the `const`) causes it to compile but never
  register, silently. Declare helper functions *after* the middleware
  instead (they still work — function declarations hoist).
- `priority` — lower numbers run **later** in this codebase's convention (see
  the auth guard below, priority 10, running after `services.ts`'s
  priority 100).
- Call `next()` to continue, or `block(reason, redirectPath)` to stop
  navigation and redirect.

## A real guard example

```ts
// middlewares/auth.ts
// @Middleware({ target:"page", stage:"route_matched", priority:10 })
const authGuard = async (context: any, next: any, block: any) => {
  const PUBLIC_PAGES = new Set(["login", "forgot-password", "reset-password"]);
  if (PUBLIC_PAGES.has(context.pageName)) {
    await next();
    return;
  }
  if (!hasFreshAccessToken()) {
    block("Not authenticated", "/login");
    return;
  }
  await next();
};
```

## Ordering matters

`services.ts` initializes `egretClient` at priority 100 (runs first);
`auth.ts` at priority 10 depends on that service being ready to make a
token-refresh call. Put shared setup at a higher priority number than
anything that depends on it.

See [Authentication & Authorization](/docs/guides/backend-and-auth/authentication-and-authorization)
for the full auth-guard pattern.
