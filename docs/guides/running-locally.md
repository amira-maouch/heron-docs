---
sidebar_position: 1
---

# Running Heron Locally

## Prerequisites

- Node.js 20+
- pnpm 10+ (`packageManager` is pinned to `pnpm@10.4.1` in the root
  `package.json`)

## Install

```bash
git clone <heron-repo-url>
cd heron
pnpm install
```

## Build and typecheck

```bash
# Build all packages
pnpm build

# Build one package only
cd packages/page-engine && pnpm build

# Type check everything
pnpm typecheck
```

## Run tests

```bash
pnpm test
```

## Notes

- This is a Turborepo-managed monorepo (`turbo.json`), so `pnpm build` /
  `pnpm test` fan out to each package via Turbo's task graph and cache.
- See [Heron Overview](/docs/heron/overview) for what each package does, and
  [Architecture](/docs/heron/architecture) for cross-package contracts to
  keep in mind while developing.

:::tip Adding another guide
Add a new `.md` file next to this one (or a subfolder with its own
`_category_.json` for a nested group), link it from here, commit, and push —
the deploy picks it up automatically.
:::
