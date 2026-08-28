---
sidebar_position: 3
---

# Widget API Best Practices

- **One `$egret.getService("egretClient")` per script, reused.** Don't call
  `getService` repeatedly inside handlers — grab it once at the top of the
  script.
- **Always check `.ok` before touching `.data`.** Every `egretClient` call
  returns a result envelope, not a thrown error on failure — an unchecked
  `.data` access on a failed call reads `undefined` silently.
- **Use `on`/`off` instead of `listen` when more than one part of a widget
  needs the same event.** `listen()` overwrites per event name; it's for
  "this child, this one handler," not accumulation.
- **Don't call `setProps` in a tight loop.** Batch updates into a single
  `setProps({...})` call where possible — each call triggers a re-render.
- **Scope translations to the widget with `_self`, don't put per-page copy in
  app-level namespaces.** Shared namespaces (`common`, `errors`, `validation`)
  are for strings genuinely reused across many widgets — a page's own labels
  belong in its `translations/_self/`.
- **Check `$egret.auth.can(...)` server-side too, not just to hide UI.** A
  pruned/hidden button is a UX nicety; the backend command/query must enforce
  the same rule, or hiding the button is not real authorization.
- **Prefer `runCommand`/`runQuery` by id over hand-built fetch URLs.** The
  service handles base URL, auth headers, and response unwrapping —
  hand-rolled `fetch()` calls in a widget script drift from that and break
  silently when the API shape changes.
