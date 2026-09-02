---
sidebar_position: 4
---

# Workspace Widgets & State Lifetime

Patterns for master-detail screens — a list/rail on one side, a selected
record's editor on the other, where clicking a different row shouldn't
rebuild the whole page. The throughline: **route ownership, data ownership,
and state lifetime should all match each other.**

## Use a parent workspace when sibling pages share expensive data

Nested routes are for URLs that are really a **selection inside the same
working context**, not independent screens:

```text
/items          → owns the list
/items/:id      → identifies the selected item
```

The workspace (the parent route) owns data shared across every selection —
the list rows, any shared reference data — and hands the selected `id` plus
cached data to the detail editor. Otherwise every row click rebuilds the
whole page and re-fetches the same list it already has.

Use separate (non-nested) pages when screens have genuinely independent
data. Use a workspace when changing the URL param is mostly "change what's
selected," not "load a different screen."

Always define conflicting static routes explicitly, or they collide with
the dynamic one:

```text
/items/new
/items/archived
/items/groups/:id
/items/:id
```

## A route change and a component remount are different decisions

`go("/items/123")` asks the router to reconstruct the page — even when most
of the screen (the rail, the workspace chrome) is identical to what's
already there. For an in-workspace selection: update the active row/title,
hand the editor the new item's data, and update the URL **without**
remounting the workspace. Reserve real router navigation for actually
leaving the workspace.

Pick `pushState` vs `replaceState` deliberately: `pushState` if Back should
step through previous selections; `replaceState` if the selection is
transient workspace state that shouldn't clutter history.

## Explicitly hydrate every field on selection change — don't rely on remount

Heron reuses component instances by stable id where it can (good for
performance) — which means a widget is **not guaranteed to remount** just
because the selected id changed. Old field values can survive:

```ts
// Right: write every field, including the empty ones
nameField.setProps({ value: draft?.name ?? "" });
```

Only setting fields that *have* a value leaves the previous item's value on
screen for whatever wasn't set. A component id identifies a UI node — not
which record currently owns its state.

## Scope state to its real lifetime, and key it by record id

Different data needs different homes:

| Lifetime | Where it lives |
|---|---|
| One editor controller | Component-local variable |
| One record's unsaved draft | `drafts[recordId]` |
| Shared while moving between records | Workspace-closure cache |
| Survives leaving/reopening the page | Persistent browser storage |
| Saved business data | The server |

```ts
cache.drafts[recordId]  // a draft survives switching away and back
```

The workspace cache belongs to the workspace's closure and gets cleared on
unload — never `window` or `localStorage` for state that should disappear
once you leave.

Never store multiple records' unsaved state in one shared variable —
`let draft = ...` silently becomes "whichever record touched it last." Key
it: `drafts[id]`. Applies to form drafts, open panes, validation errors,
temp uploads, pending selections, per-record pagination, optimistic
changes — and decide deliberately whether something like tab selection is
workspace-wide or per-record, rather than letting component reuse decide it
by accident.

## Hydrate known data before awaiting secondary requests

A common flicker bug: awaiting a secondary request *before* applying a
value the workspace already had locally (from the initial load, or a
previous fetch) — so the UI briefly renders a fallback before showing the
value it already knew.

```text
Bad:  render fallback → await secondary request → apply known value
Good: apply the known value immediately → await the secondary request only
      for the specific fields that genuinely still need it
```

An async dependency should only delay the piece of UI that actually depends
on it — not everything downstream of it in the code.

## Don't render misleading defaults during loading

A default is valid business data, not a loading state. If the current value
is genuinely unknown, show a skeleton, a disabled field, or empty — not a
default value. Users read a rendered default as real state; when it then
changes to the actual value, that reads as a bug even though nothing was
technically wrong.

## Cache shared data at the workspace level, with a real invalidation policy

The initial list response often already carries what several parts of the
page need — reuse it instead of each detail controller re-fetching on every
selection:

```ts
// Workspace loads shared datasets once
await Promise.all([listItems(), listReferenceData()]);
```

Give the cache a real policy, not just a load: update the row after saving,
remove it after deletion, refetch if an id is unexpectedly missing, and
destroy the whole cache on leaving the workspace.

## Guard against stale async results

Switching records doesn't cancel requests already in flight — a slow
response for the *previous* selection can land after the *new* one is
already showing, and overwrite it. Real pattern:

```ts
const isCurrent = () => lifecycle.active && lifecycle.mount === mount;
```

Check this after every meaningful `await` — loading the record, secondary
data, related lists, autosave — and bail if it's false. Pair with
`AbortController` where you can to cancel the request outright, not just
ignore its result.

## Clean up route-owned resources on unmount

Leaving a page should dispose of autosave/polling timers, `window`/
`document` listeners, pending retries, and route-local drafts/caches — or
old controllers stay alive and can respond to input meant for whatever
replaced them.

Match your Heron version's lifecycle API — newer versions expose
`page_unload`, older ones exposed `onUnmount` directly. A small compatibility
helper keeps this from crashing on either:

```ts
export function onPageUnload($egret: any, cleanup: () => void): void {
  const lifecycle = $egret?.page?.lifecycle;
  if (typeof lifecycle?.onUnmount === "function") {
    lifecycle.onUnmount(cleanup);
    return;
  }
  if (typeof lifecycle?.use !== "function") return;
  const name = `cleanup-${Math.random()}`;
  lifecycle.use("page_unload", async (_ctx: unknown, next: () => Promise<void>) => {
    try { cleanup(); await next(); } finally { lifecycle.remove?.("page_unload", name); }
  }, { name });
}
```

## Be careful with global event delegation

Repeatedly mounting a widget that adds a `document`-level listener each time
can turn one click into several old handlers firing at once. Prefer
component-level listeners. If you genuinely need document delegation:
register it once (or remove it on unload), guard the handler with
`isCurrent()`, and make sure it never permanently captures an old `$self`,
cache, or record id — the listener can be long-lived, but the controller
logic it calls into must be replaceable.

## Flush edits before switching records

Selecting a different record shouldn't discard an autosave already in
flight. Safe order: flush current edits → remember any UI-only unsaved
drafts → update the active row/title → select the next record → hydrate
its fields → update the URL. If the flush fails, stay put and show the
error — don't navigate away and silently lose the edit.

## Read route params through the router API, not manual parsing

```ts
$egret.getPageParams().queryParams.id
```

Not hand-parsing `currentRoute()` or splitting the pathname — that gets
fragile the moment routes gain an app prefix, nesting, optional segments,
search params, or legacy aliases. The manifest owns URL structure; widgets
just consume the named params it resolves.

## Test timing, not only final output

Most bugs here resolve too fast for a final-state-only test to ever see
them. Write tests that deliberately hold a request open and inspect
*intermediate* state: hold a secondary request open and assert the fallback
never renders; delay an old record's response and assert it can't overwrite
the new one; switch records and assert drafts stay isolated; leave the
workspace and assert drafts are discarded; assert shared lists are fetched
exactly once. A test that only checks the end state misses nearly every
flicker and race condition this page is about.
