---
sidebar_position: 2
---

# How to Add a Component to `heron_registry`

This is about **publishing** a new component so any app can vendor it — a
platform-level task, not something you do per consumer app. If you just want
to use an existing component, see
[How to Vendor a Registry Component](/docs/guides/setup/vendor-a-registry-component)
instead.

## Where it lives

`heron_registry` is a separate repo/workspace from your app and from the
`heron` framework monorepo. Components (and plugins, and services) are
discovered by a **plain filesystem convention** — no catalog file to update:

```
registries/<registry>/components/(<namespace>)/<name>/
├── contract.json
├── src/index.tsx
└── playground/            (optional) examples.json + fixtures/
```

The build scans every `registries/<registry>/{components,services}/(<namespace>)/<name>/`
folder and compiles each namespace into one content-addressed ESM graph — one
entry file per component, plus each component's CSS — which the registry
server serves and apps vendor. Adding a component is adding a folder, not
registering it anywhere.

Named registries you'll see: `shadcn` (thin wrappers over `@workspace/ui`),
`ui` (generic, app-agnostic), `egret-ui` (data-aware components + core
services like `egret-client`), plus per-app registries (e.g. `alefbab`) for
domain-specific components that don't belong in a shared one.

## Re-exporting an existing component

Most registry components are a one-line re-export of a real implementation
that already exists elsewhere (a design-system package, for instance) — the
registry artifact is a thin, stable pointer to it. Real example, the
registry's own `shadcn:button`:

```tsx
// registries/shadcn/components/(shadcn)/button/src/index.tsx
export { Button as default } from "@workspace/ui";
```

The registry doesn't own the component's implementation — it owns the
contract that lets Heron apps discover and load it. Logic belongs in the
package; the registry folder stays glue.

If widget scripts must *drive* the component (`toaster.success("Saved")`),
register those methods with `useEnhanceAPI` and list them under `methods` in
the contract.

## Writing `contract.json`

Start with the identity header and let the tools fill in the rest:

```json
{
  "contractVersion": "1.0.0",
  "artifactType": "component",
  "id": "ui:feedback:empty-state",
  "registry": "ui",
  "namespace": "feedback",
  "name": "empty-state",
  "version": "1.0.0",
  "description": "What it does, when to use it, and every non-obvious rule.",
  "frameworkRuntime": "react",
  "environment": ["universal"],
  "bundle": { "deliveryType": "source", "entry": "src/index.tsx" }
}
```

- `id` / `registry` / `namespace` / `name` — always write them. Apps vendor
  this exact file; a contract without `name` is skipped by app codegen
  **silently**, leaving the component untyped.
- `description` — becomes the documentation widget authors read in their
  editor. Write prose, not a label.
- `environment` — `["universal"]` means it can run both server- and
  client-side. If your component genuinely can't render server-side, use
  `["browser"]` — see [Using SSR](/docs/guides/ssr/using-ssr).
- `version` — the release identity. See
  [Registry Component Versioning](/docs/explanation/registry-component-versioning)
  for when to bump which part.
- Required props use `"isRequired": true` — not `"required": true`, which is a
  JSON Schema error that aborts the whole registry build.

### Let `contract:sync` write the rest, and `contract:lint` check it

```bash
pnpm contract:sync    # fill the contract in from the source
pnpm contract:lint    # fail on anything the source and contract disagree on
```

`contract:sync` reads the component's TypeScript props and **fills in** what
is missing (it never overwrites what you wrote):

- **`props`** — full JSON Schemas, nested objects and arrays included, shared
  shapes lifted into `$defs`. A type that has no JSON form (a DOM element, a
  ref) is recorded as `x-ts-type` so tools know only code can pass it.
- **`styling`** — which CSS technologies the component uses and its mode
  (below).
- **`requires.providers`** — the context providers it needs. Sync actually
  renders the component; when it throws "must be used within `TooltipProvider`",
  the provider is found in the registry and recorded.
- **`role: "provider"`** — on components that only supply context.

`contract:lint` fails when they disagree — a prop in the code but not the
contract, a prop typed `object` with no shape, a styling mode the CSS does not
match, a `fetch` to a URL no prop or service declares, a missing provider. Run
both before every PR.

### Data: no hidden fetches

A component must not fetch from a URL it invented or read `process.env`. Data
comes from one of: a URL **prop** (`format: "uri-reference"`), a `DataSource`
prop (`$ref` to the registry's data-source schema), or a service declared in
`requires.services`. Environment values become props or `requires.env`. Lint
enforces this, and it is what lets the playground stub the data.

## Styling

Every component renders inside its own boundary element
(`data-heron-component="registry:namespace:name@version"`), and its CSS —
Tailwind, plain CSS, CSS modules, Bootstrap — is scoped to that boundary at
build time. You write normal CSS; the build guarantees it cannot restyle the
host app or another component, and `:root`/`body` rules apply to the
component, not the page. You do not add attributes or prefixes yourself.

The contract's `styling.mode` says how the component relates to the app's
theme:

| Mode | Meaning |
|---|---|
| `host-themed` | Reads the app's design tokens (`--primary`, `--background`, …) and follows its theme. List the tokens in `styling.requiresTokens`. |
| `self-styled` | Ships a fixed look; theming the app does not change it. |
| `headless` | Ships no CSS; the app styles it. |

Global side effects are not allowed, except `@font-face` when
`styling.globalEffects` is `"fonts"`.

## Compound components and providers

A family of parts that share one context (dialog → trigger, content, title…)
declares `partOf` (the family root) on each part, and
`structure.requiresAncestor` / `allowedChildren` where placement matters. Give
the **root** an `editor.anatomy` — the whole family as a tree — and each part
an `editor.anchor`, so tools can always render a part in a valid place.

A component that needs a context from outside its family lists it:

```json
"requires": { "providers": ["shadcn:shadcn:tooltip-provider"] }
```

Apps must place that provider above it; the playground wraps it automatically.

## Figuring out its id

The id used in `metadata.json` (`"registry:namespace:type"`) comes directly
from the folder path — no separate registration step assigns it:

```
registries/<registry>/components/(<namespace>)/<name>/  →  "<registry>:<namespace>:<name>"
```

Real examples:
- `registries/shadcn/components/(shadcn)/button/` → `shadcn:shadcn:button`
- `registries/ui/components/(display)/avatar/` → `ui:display:avatar`
- `registries/egret-ui/services/(core)/egret-client/` → the service id
  `egret-ui/core/egret-client` (services are referenced by path, not the
  colon-separated component id — see [Services](/docs/guides/setup/services)).

If you can see the folder, you already know the id — there's nothing else to
look up.

## Try it in the playground

Before publishing, open it in the
[Registry Playground](/docs/guides/setup/registry-playground):

```bash
pnpm build && pnpm playground:build && pnpm start
# http://localhost:4100/playground
```

Add at least one `editor.examples` entry so the component opens in a useful
state — a generated example is only a smoke test.

## Publishing

```bash
pnpm publish:check        # what needs a version bump, and why
pnpm release:bump         # bump every component that needs it (semver from the contract diff)
pnpm publish:components   # write the immutable releases
```

`release:bump --dry-run` prints the plan first. Commit the bumped contracts and
the new files under `releases/`. Details in
[Registry Component Versioning](/docs/explanation/registry-component-versioning).

## After publishing

The component isn't usable in any app until that app vendors it — add it to
the app's `bundle-manifest.json`. See
[How to Vendor a Registry Component](/docs/guides/setup/vendor-a-registry-component).
