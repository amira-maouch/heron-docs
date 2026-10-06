---
sidebar_position: 2
---

# Package Scripts & Linting

The minimal `package.json` setup for a Heron app: the scripts every app has and
what each does, plus how to wire up linting with the shared security rules. For
the files and folders themselves, see [App Structure](/docs/heron/app-structure).

## Dependencies (minimal)

A Heron app needs the runtime and the component API at minimum:

```jsonc
{
  "dependencies": {
    "@heron-ws/app-runtime": "^4.2.0",
    "@heron-ws/component-api": "^6.0.0"
  }
}
```

The `@heron-ws/*` packages come from GitHub Packages, so the app needs an
`.npmrc`:

```ini
@heron-ws:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

with `NODE_AUTH_TOKEN` set to a token that has `read:packages`.

## Scripts

These are the standard scripts. The `heron-*` binaries are provided by
`@heron-ws/app-runtime`.

```jsonc
{
  "scripts": {
    "dev": "pnpm build:app && concurrently -k -n server,watch -c blue,yellow \"pnpm dev:server\" \"pnpm dev:watch\"",
    "dev:server": "heron-dev-api",
    "dev:watch": "heron-watch-widgets --no-initial-build",

    "build": "pnpm lint && vite build && pnpm build:ssr && heron-build-app",
    "build:shell": "vite build",
    "build:ssr": "node ./node_modules/@heron-ws/app-runtime/bin/build-ssr.js",
    "build:app": "heron-build-app",
    "build:app:steps": "heron-build-plugins && heron-build-components && heron-build-middleware && heron-build-widgets",

    "start": "heron-prod-server",
    "preview": "vite preview",

    "clean:artifacts": "heron-clean-artifacts",
    "clean:artifacts:dry": "heron-clean-artifacts --dry-run",

    "lint": "eslint widgets"
  }
}
```

### What each does

| Script | Purpose |
| --- | --- |
| `dev` | Build the app artifacts once, then run the dev API server and the widget watcher together. The everyday command. |
| `dev:server` | The dev HTTP server (`heron-dev-api`) — serves the app, the page engine, and the `/api/*` routes. |
| `dev:watch` | Rebuilds widget artifacts on change; `--no-initial-build` because `dev` already built once. |
| `build` | Full production build: **lint → shell (`vite build`) → SSR entry → app artifacts**. Lint runs first so problems surface before the slower steps. |
| `build:shell` | Just the Vite build of the app shell. |
| `build:ssr` | Builds the server-side render entry. |
| `build:app` | Compiles plugins, components, middleware, and widgets (`build:app:steps` is the expanded form). |
| `start` | Runs the production server against a completed build. |
| `preview` | Vite's static preview of the built shell. |
| `clean:artifacts` | Removes generated build artifacts (`:dry` just lists them). |
| `lint` | Lints widget sources — see below. |

## Linting

Heron ships a shared ESLint config, `@heron-ws/eslint-config`, so apps don't
each maintain their own rules. Its `security` fragment flags the
string-to-HTML / string-to-code sinks that cause XSS and code injection
(`innerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, …) as **warnings**.
The safe path those warnings point at is `html` / `setHTML` / `sanitize` from
`@heron-ws/utils` — see
[Safe HTML Rendering](/docs/best-practices/safe-html-rendering).

### Install

```bash
pnpm add -D @heron-ws/eslint-config eslint @typescript-eslint/parser
```

The TypeScript parser is needed so ESLint can read `.ts`/`.tsx` widget sources.

### `eslint.config.mjs`

A minimal flat config — it wires the parser to your widgets and spreads the
shared rules; it defines **no rules of its own**:

```js
import tsParser from "@typescript-eslint/parser";
import { security } from "@heron-ws/eslint-config";

export default [
  { ignores: ["dist/**", "dist-app/**", "bundles/**", "node_modules/**", "**/*.d.ts"] },
  {
    files: ["widgets/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  ...security,
];
```

React app shells can additionally spread `reactSecurity` (adds
`react/no-danger`) — only where the `react` ESLint plugin isn't already
registered:

```js
import { security, reactSecurity } from "@heron-ws/eslint-config";
export default [/* …parser block… */ ...security, ...reactSecurity];
```

### Wire it into the build

Add `lint` and run it first in `build` (shown above). The rules are warnings, so
a finding **does not fail** the build — it shows up in the output as a prompt to
review. To make new findings block CI instead, run the lint step with a ceiling:

```bash
eslint widgets --max-warnings 0
```

A warning is a decision point: convert the sink to `html` + `setHTML` (or
`.textContent` / `.value` / React children), or, if the line is genuinely safe,
disable the specific rule on it **with a justification comment** — never a bare
disable:

```ts
// eslint-disable-next-line no-unsanitized/property -- value is sanitize()d upstream; see #123
el.innerHTML = trusted;
```
