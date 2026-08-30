---
sidebar_position: 6
---

# Debugging Heron Apps

Common failure modes and how to actually find them — most Heron failures are
**silent**: no thrown error, just a blank spot or a stuck loading state.

## A subtree is just... blank

**Likely cause**: the component id in `metadata.json` couldn't be resolved
(typo in `registry:namespace:type`, or not vendored — see
[How to Add a Component to the Registry](/docs/guides/setup/vendor-a-registry-component)).
A missing component still emits `component_ready` (so the page doesn't hang),
but logs a console error and renders nothing. **Check the browser console
first**, not the network tab.

## Page stuck on a loading state forever

**Likely cause**: a `component_ready` mismatch. Every component that emits
readiness must use its **exact full dot-path id** — if a component's `id` in
the tree doesn't match what it emits, the parent never sees all children as
ready and the page never reaches `pageReady`.

## A middleware seems to just... not run

**Likely cause**: the `@Middleware({...})` annotation wasn't the *leading*
comment directly above the `const`. Check for a stray `function` declaration
between the comment and the middleware — that silently breaks registration.
See [How to Create a Middleware](/docs/guides/setup/how-to-create-a-middleware).

## `setProps` right after `getChild` seems to work even before mount

That's expected — `getChild()` on a not-yet-mounted component returns a
deferred proxy that queues `setProps` calls until the real component
registers. Not a bug.

## `listen()` handler silently disappeared

`listen()` **overwrites** handlers per event name, it doesn't add to them.
Calling `listen({ onClick: h1 })` and later `listen({ onClick: h2 })` on the
same child drops `h1`. Use `$self.on(...)`/`off(...)` if you need multiple
subscribers on the same event.

## Translated string shows the raw key

The namespace probably wasn't loaded. `common`/`actions` load automatically;
everything else (`components`, `validation`, `errors`, or your own) needs an
explicit `$egret.i18n.loadNamespaces([...])` — see
[How to Add Translations](/docs/guides/widgets/how-to-add-translations).

## Changed `app.config.ts` but nothing happened

App config is read once at process start. Restart the dev/prod server after
editing `app.config.ts` or `.env` — a file save alone won't pick it up.

## `$egret.auth.can(...)` always returns `false`

Auth checks fail closed while permissions are still loading (`status !==
"ready"`). Don't gate a loading spinner on a `can()` check — it'll never
resolve `true` before permissions arrive. See
[Authorization Checks](/docs/guides/backend-and-auth/authorization-checks).

## An SSR route renders differently than its CSR twin

See [Using SSR § Testing SSR locally](/docs/guides/ssr/using-ssr#testing-ssr-locally)
for the View Source / curl / disabled-JS checklist.
