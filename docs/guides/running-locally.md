---
sidebar_position: 0
---

# Running Heron Locally

Every Heron app uses the same handful of scripts, from `@heron-ws/app-runtime`'s
CLI. Real example, `alefbab_app/package.json`:

```json
"scripts": {
  "dev": "pnpm build:app && concurrently -k -n server,watch -c blue,yellow \"pnpm dev:server\" \"pnpm dev:watch\"",
  "dev:server": "egret-dev-api",
  "dev:watch": "egret-watch-widgets --no-initial-build",
  "build": "vite build && egret-build-app",
  "build:shell": "vite build",
  "build:app": "egret-build-app",
  "start": "egret-prod-server",
  "preview": "vite preview"
}
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (check `packageManager` in your app's `package.json`)

## Install

```bash
pnpm install
```

## Dev

```bash
pnpm dev
```

Builds the widget app once, then runs the API dev-server and a widget
file-watcher concurrently — edits to `metadata.json`/`script.ts`/`server.ts`
hot-rebuild without a full restart.

## Build

```bash
pnpm build
```

Runs `vite build` (the client shell) then `egret-build-app` (bundles widget
metadata, scripts, and vendored registry components into `dist-app/`). On an
SSR-enabled app this also runs `build:ssr` first — see
[Using SSR](/docs/guides/ssr/using-ssr).

## Run in production

```bash
pnpm start
```

Runs `egret-prod-server` against the build output — this is what actually
serves the app (and, if SSR is enabled, renders the HTML document) in
production.

## Preview a build locally

```bash
pnpm preview
```

Serves the built client shell via Vite's preview server, without the full
`egret-prod-server` (useful for a quick static check, not for testing SSR or
API routes).

## Testing

There's no single `pnpm test` for a consumer app. What exists depends on
whether SSR is enabled:

- **Any app**: your own test setup, if you've added one (Vitest, Playwright,
  etc. aren't provided by the framework).
- **SSR-enabled apps** get real smoke scripts for free, real example from
  `bootstrap_app/package.json`:
  ```json
  "smoke:hydration": "node ./smoke/hydration-browser.mjs",
  "smoke:auth-isolation": "node ./smoke/auth-isolation-browser.mjs",
  "benchmark:ssr": "node ./smoke/ssr-benchmark.mjs"
  ```
  These drive a real headless browser against your running SSR server. See
  [Using SSR § Testing SSR locally](/docs/guides/ssr/using-ssr#testing-ssr-locally).
