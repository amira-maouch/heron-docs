---
sidebar_position: 0
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
- This is about developing the Heron **framework** itself. If you're building
  an app on top of Heron rather than contributing to it, start at
  [App Structure](/docs/heron/app-structure) instead.

:::tip Adding another guide
Add a new `.md` file next to this one (or a subfolder with its own
`_category_.json` for a nested group), link it from here, commit, and push —
the deploy picks it up automatically.
:::
