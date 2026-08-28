# Heron Docs

Documentation site for Heron — reference docs, how-to guides, and migration
guides. Built with [Docusaurus](https://docusaurus.io/).

## Structure

- `docs/heron/` — what Heron is and how it's architected
- `docs/guides/` — task-focused how-to guides
- `docs/migration/` — versioned migration guides (start from `template.md`)

Folder structure maps directly to routes and the sidebar, including nesting —
add a file or subfolder under `docs/`, commit, push, and it deploys
automatically.

## Local development

```bash
npm install
npm start
```

Opens a local dev server at `http://localhost:3000` with hot reload.

## Build

```bash
npm run build
```

Outputs a static site to `build/`.

## Deployment

Deployed via [Vercel](https://vercel.com), connected to this repo's `main`
branch — every push redeploys automatically.

## Versioning docs

Docs aren't versioned yet. Once needed:

```bash
npm run docusaurus docs:version 1.0
```

See `docs/intro.mdx` for details.
