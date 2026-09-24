---
sidebar_position: 1
---

# Registry Component Versioning

This page explains how versioning works in the Heron component registry: what a
version _is_, how a consuming app asks for one, what triggers a new version,
and why two things that look like "using Button" follow opposite rules. It is a
conceptual explanation, not a how-to.

## The one-sentence model

**Every component has its own SemVer version, published as an immutable
release. A consuming app requests a version with a selector (`1.4.2`, `^1.4`,
`~1.4`, `latest`, `*`); the app build resolves that selector once, pins the
exact result in `.bundle-lock.json`, and the browser and SSR only ever load the
pinned bytes.**

Changing one component publishes a new version of **that component only**.
Nothing else in its namespace or registry is re-versioned.

## The entities (kept separate on purpose)

Five different ideas are often collapsed into "version". Heron keeps them
distinct:

| Concept | What it identifies | Example |
|---|---|---|
| **Build / byte identity** | the exact bytes of one emitted file | `spinner-GD5B2CVE.js`, `sha256:…` |
| **Component version** | the public-contract release identity of one component | `ui:feedback:spinner@2.0.0` |
| **Selector** | what an app _asks_ for | `^1.0.0`, `~1.0.0`, `latest` |
| **Resolution result** | the exact version chosen for this app, recorded in the lock | `spinner → 2.0.0` |
| **Registry / runtime version** | the artifact format + consumer/runtime ABI | ESM graph schema, `@heron-ws/app-runtime-server` |

A component's SemVer describes **its own public contract** — nothing else. A
sibling changing, a namespace re-building, or the runtime upgrading does **not**
change a component's version.

## Coordinates and scopes

A component coordinate has three parts: `registry:namespace:name`
(`ui:feedback:spinner`). In a `bundle-manifest.json` the same coordinate is
written with slashes, and the scope is implied by how many parts you use:

```text
ui                       registry scope
ui/feedback              namespace scope
ui/feedback/spinner      component scope
```

Selectors can be attached at any scope. Component scope is where independent
versioning is most precise.

## Selectors (syntax)

The value of a manifest entry is a **selector**:

| Selector | Means | Example resolution (versions 1.0.0, 1.1.0, 2.0.0 published) |
|---|---|---|
| `1.4.2` | exactly this version | `1.0.0` → `1.0.0` |
| `~1.4.0` | latest **patch** within `1.4.x` | `~1.0.0` → `1.0.0` (won't take `1.1.0`) |
| `^1.4.0` | latest **minor/patch** within `1.x` | `^1.0.0` → `1.1.0` (won't take `2.0.0`) |
| `latest` / `@latest` | newest stable release | → `2.0.0` |
| `*` | alias for `latest` (compatibility) | → `2.0.0` |

The two "won't take" rows are the whole point of ranges: `~` never crosses a
minor, `^` never crosses a major. That is what makes a range safe.

## Selector reproducibility: manifest vs lockfile

Selectors are convenient but must never make a deployed build load an untested
version. Heron separates the two files:

- **`bundle-manifest.json`** holds selectors — the _intent_ (`^1.4`, `latest`).
- **`.bundle-lock.json`** holds the _resolved result_ — exact version + the
  content hashes of every file that was vendored.

Resolution happens **once**, during the app build (`heron-build-components`),
against the registry. After that the browser and SSR never resolve versions.
They load only what the lock pins.

A plain build is now authoritative to that lock. `*`, `latest`, `^`, and `~`
used to mean "ask the registry again" on every `pnpm dev` or rebuild, so
publishing a component could change an app the next time someone built it, with
no commit and no review. That is why a normal build reuses the pinned version
even when a newer release matches the selector. The selector is re-resolved
only when it actually changed in `bundle-manifest.json`, when the lock entry or
its files are missing, or when you ask for an update on purpose:

```bash
heron-build-components --update          # re-resolve, rewrite .bundle-lock.json
HERON_UPDATE=1 heron-build-components    # same thing
```

Commit the lock with that change. CI should refuse to move it:

```bash
heron-build-components --frozen-lockfile
HERON_FROZEN_LOCKFILE=1 heron-build-components
```

A frozen build fails if the lock is missing or out of date, instead of quietly
fetching whatever the registry currently calls latest. So `latest` in the
manifest means "newest at the last update", pinned thereafter — not "newest at
every page load".

## What triggers a new component version

A component gets a new version **only when its own public contract or compiled
output changes**, and you bump its `version` in `contract.json`:

- **patch** (`2.0.1`): implementation/style change, same contract.
- **minor** (`2.1.0`): additive contract — a new optional prop, event, method.
- **major** (`3.0.0`): a breaking contract change — removing/renaming/retyping a
  prop, event, method, slot, or style hook.

It is **not** triggered by:

- another component in the same namespace changing,
- the namespace or registry being rebuilt,
- the artifact format or runtime changing (IIFE → ESM),
- a compatible (`^`) change in something it depends on.

The registry enforces the floor of this rule: **re-publishing an existing
version with different bytes fails.** If you change a component and forget to
bump, publication refuses it ("already exists with different component
artifacts"). Choosing the _level_ (patch/minor/major) is the author's judgment;
_whether_ a bump is required is enforced.

### What gets re-vendored

Because the lock pins per-component content hashes, changing component **A** and
publishing **A@next** means: an app that updates to A@next re-downloads **A's**
files only. Unchanged components keep their hashes and stay cached. There is no
namespace-wide or registry-wide re-download for a one-component change.

## What triggers a _dependent_ component's version

Sometimes a change to **B** forces **A** to change too — but only when A's own
code or contract must change:

- B ships a **breaking** major that A actually consumes (B removed something A
  used).
- B is a **shared singleton** (see below) whose shape A reads changed
  incompatibly.

A compatible (`~`/`^`) change in B never bumps A — the resolver just picks the
new B; A's bytes are untouched. This is the "at most, genuine dependents change"
rule.

## Two kinds of "using Button" (this trips everyone up)

There are two completely different senses in which one component "uses"
another, and they follow opposite duplication rules — exactly like npm.

### 1. Using another component as _source code_ (a dependency)

`alert.tsx` does `import { Button } from ".../button"`. This is a **build-time
library dependency**, like any npm import. Alert declares
`dependsOn: { button: "^1.0.0" }`.

- If button ships `2.0.0`, `^1.0.0` does **not** take it — alert keeps building
  against button `1.x`. "Alert still works with button v1 unless it says
  otherwise."
- If the app _also_ uses button `2.0.0` elsewhere, you get **two button copies**
  in the app (button 1 inside alert, button 2 for the app). This duplication is
  **normal and expected** — it is the price of independent versioning, and it is
  exactly how npm's nested `node_modules` behaves.

Duplication here is harmless because a plain button is **stateless** — two
copies in memory each just render a `<button>`.

### 2. Using a component as a _node in the widget tree_ (a coordinate)

When `ui:feedback:spinner` appears as a node in a widget's `metadata.json`, it
is a **registered component coordinate**. The running app registers exactly one
component under that id, so **an app resolves one version per coordinate**. If
two constraints on the same coordinate can't agree, resolution fails (you widen
a range or bump) — the app never silently registers two versions under one id.

**Rule of thumb:** duplicate freely for stateless code reuse (dependency);
resolve to one version for anything placed in the tree or that must be a single
instance.

## Shared context vs. dependency (`partOf` / singletons)

Some components must share **one live instance** of something — a React context.
A `<Sidebar>` provider and a `<SidebarMenuButton>` consumer must talk about the
_same_ context object, or the wiring silently breaks. That shared module is a
**singleton dependency**: it is externalized and resolved to exactly one
version app-wide, then mapped to one URL so the browser loads it once. This is
the same mechanism that already makes React a single instance across
independently-built components.

Two important clarifications:

- **Module singleton ≠ global state.** The _context object_ is a singleton
  (one definition, one URL). Each `<SidebarProvider>` still renders its own
  `Provider` with its own value, scoped to its subtree. Two sidebars, three
  accordions, two dropdowns → many independent states, all using the one shared
  context object. No cross-page bleed.
- **`partOf` marks a runtime-singleton family** (members that share one context
  instance), _not_ mere code reuse. A stateless component that just imports
  another's code is a plain dependency (previous section), **not** `partOf`.

Members of a singleton family are genuine mutual dependents: when the shared
context itself changes incompatibly, the members that read it are the "dependent
components" that must bump together. Independent, stateless components never
have this coupling.

## Contracts

`contract.json` is the source of a component's identity:

- `version` — the SemVer that publication makes immutable.
- `props` / `events` / `methods` — the public contract that determines whether a
  change is patch/minor/major.
- Styling and placement fields (`styling.mode`, `partOf`, structural rules)
  travel with the release and are validated at build/publish time.

The published release record is derived from the contract plus the compiled
artifacts and is content-addressed, so a version always points at exact bytes.

## Registry / runtime vs. component versioning

These are versioned independently:

- **Component version** — the component's own public contract.
- **Consumer/runtime** (`@heron-ws/app-runtime-server`, the ESM graph schema,
  the import-map bridge) — the machinery that builds and loads artifacts.

A runtime upgrade (for example the move from IIFE bundles to ESM graphs) is a
change to the _artifact format and consumer_, **not** to any component's public
contract, so it must **not** force a major bump on every component. An app
upgrades the runtime when it chooses to; components keep their versions. A
component only majors when its _own_ contract actually breaks.

## What "invalidates" what — summary

| Change | New component version? | Re-vendored in an app? |
|---|---|---|
| Edit component A's source/contract (and bump) | **A only** | A's files only (on update) |
| Edit A without bumping | publish **fails** | — |
| Sibling B in the same namespace changes | **no** (A unchanged) | nothing for A |
| Namespace/registry rebuilt | **no** | nothing (hashes stable) |
| Runtime/format upgrade (IIFE→ESM) | **no** | re-vendor same versions in new format |
| A's `^` dependency ships a compatible release | **no** | only if the app updates that dep |
| A shared-context singleton changes incompatibly | **its family members** bump | those members |

## End-to-end flow (change → publish → consume)

This is the full path a change travels, from editing a component to seeing it in
a consuming app. The first half happens in the registry repo; the second half in
the app.

### Registry side: publish a new version

**1. Edit the source.** Change the component's implementation.

```text
registries/<reg>/components/(<ns>)/<name>/src/index.tsx
```

**2. Bump the version.** The `version` field in the contract is the release
identity, so every meaningful change gets a new number.

```jsonc
// registries/<reg>/components/(<ns>)/<name>/contract.json
{ "version": "2.0.0" }
```

**3. Build.** esbuild compiles the whole namespace into a content-addressed ESM
graph. Only components that actually changed get new hashed filenames.

```bash
pnpm build -- --registry=<reg>
# output: registries/<reg>/components/(<ns>)/build/esm/
#   graph.json + browser/entries/<name>-<hash>.js
```

**4. Publish.** Build and publish just this component (or everything).

On macOS, use the shorthand command:

```bash
pnpm publish:component shadcn/shadcn/phone-input
```

On Windows, run the publisher directly because the shorthand relies on POSIX
shell argument forwarding:

```bash
pnpm exec tsx src/publish-component-releases.ts --component shadcn/shadcn/phone-input
```

To publish all components, use:

```bash
pnpm publish:components
```

The publisher does five things:

1. Checks the component's *own* identity (contract hash + entry hash, ignoring
   the namespace graph hash). Unchanged means skip, changed under an existing
   version means fail with "bump the version", new means write.
2. Copies files into the shared pool `releases/artifacts/modules/<reg>/<ns>/…`,
   where identical bytes are stored only once (dedup).
3. Writes the composition map `releases/artifacts/graphs/<reg>/<ns>/<hash>.json`.
4. Writes the immutable receipt `releases/components/<reg>/<ns>/<name>/2.0.0.json`.
5. Updates the mutable index `releases/indexes/components/<reg>/<ns>/<name>.json`
   with the new `versions` list and `latest`.

Older versions and their graphs are never touched.

**5. Serve.** The registry server then exposes three things:

```text
…/components/<ns>/<name>/releases/<selector>   resolve a selector to a receipt
…/graphs/<ns>/<hash>                           the composition map
…/modules/<ns>/*                               the content-addressed files
```

### Consumer side: use it in an app

**6. Declare a selector.** Pick how the app tracks the component in
`bundle-manifest.json`.

```jsonc
{ "components": { "<reg>/<ns>/<name>": "^2.0.0" } }  // or 1.4.2, ~1.4, latest
```

**7. Vendor.** Running `heron-build-components` resolves the selector once (at
build time), downloads only this component's files, verifies every hash, and
records the exact result.

- Resolves the selector against `…/releases/<selector>`.
- Fetches the composition map, then downloads the component's file closure from
  `…/modules/<ns>/*`.
- Pins the exact version and file hashes in `.bundle-lock.json`, and writes the
  files under `bundles/registries/<reg>/components/esm/(<ns>)/`.

**8. Build and run.** Later builds reuse the lock without re-resolving, so a
deploy is exactly what was tested. The browser `import()`s the pinned files and
SSR imports the pinned node entries. To move to a new version, change the
selector if you need a different range, then run `heron-build-components
--update` and commit `.bundle-lock.json`. Only the components whose resolved
release actually changed are re-fetched.

## Worked example (the shipped demo)

Three `ui` components were changed and published so both old and new versions
coexist in the registry:

```text
ui/feedback/spinner        1.0.0 (solid purple)   +  2.0.0 (green dashed)
ui/feedback/empty-state    1.0.0 (📭)             +  1.1.0 (🟢)
ui/demo/tailwind-panel     1.0.0 (plain)          +  2.0.0 (emerald "v2" pill)
```

Publishing `spinner@2.0.0` created a new version of **spinner only** — the other
components kept their versions and their previously published graphs, which
remain immutable and resolvable.

An app then requested a mix of selectors and the lock resolved:

```text
ui/feedback/spinner      "latest"  → 2.0.0   (newest)
ui/feedback/empty-state  "~1.0.0"  → 1.0.0   (tilde will not cross the minor to 1.1.0)
ui/demo/tailwind-panel   "1.0.0"   → 1.0.0   (exact pin holds although 2.0.0 exists)
```

The `alefbab_app` route `versioning-demo` renders these three components with a
note on each explaining its selector and resolved version. Change a selector,
re-run the component build, reload — only the changed component is re-vendored.
