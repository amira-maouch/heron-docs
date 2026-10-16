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

## Develop against a local component registry

Heron 5.1.4 and newer can redirect a committed registry URL to a local origin
without repeating its path or API version. This requires
`@heron-ws/app-runtime@5.1.4` and every resolved copy of
`@heron-ws/app-runtime-server` to be at least `4.1.4`; update an existing pnpm
override if it still pins an older server version. Keep the production URL in
`bundle-manifest.json`:

```json
{
  "registries": {
    "ui": "https://registry.heron.ws/api/v2/registries/ui"
  }
}
```

Then create a gitignored `bundle-manifest.local.json`:

```json
{
  "registries": {
    "ui": "http://localhost:4100"
  }
}
```

Because the local value contains only an origin, Heron resolves it as
`http://localhost:4100/api/v2/registries/ui`. Use `"*"` instead of `"ui"` to
redirect every committed registry to the same local origin. A named local
value that includes a path remains an exact URL override.

The registry builder also reads its three build-only variables from a
gitignored `.env.local`:

```dotenv
HERON_REGISTRY_TOKEN=<the token accepted by the local registry>
HERON_ALLOW_INSECURE_REGISTRIES=1
HERON_ALLOW_UNSIGNED_COMPONENTS=1
```

Now the normal `pnpm dev` command works without exporting the variables for
each terminal session. Explicit shell and CI values take precedence over
`.env.local`.

The flags permit localhost HTTP and unsigned local releases; they do not
disable registry authentication. Omit `HERON_ALLOW_UNSIGNED_COMPONENTS` when
the local release is signed, and never enable either flag in CI, staging, or
production. Never commit `.env.local` or its token.

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
