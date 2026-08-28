---
sidebar_position: 2
---

# SSR Best Practices

- **Default to CSR.** Turn SSR on per-route, deliberately, for pages where
  first paint or crawlability actually matters. Don't flip the app-wide
  `ssr.default` to `true` just to avoid per-route config.
- **Always give client-only widgets a real placeholder**, not just the
  `minHeight: 2.5rem` fallback, for anything visually significant (a chart, a
  map). A generic empty box for a moment is fine; a layout jump is not. See
  [CSR Placeholders](/docs/guides/ssr/csr-placeholders).
- **Keep `renderMode: "client-only"` boundaries as low in the tree as
  possible.** It's an opaque boundary — everything under it loses SSR, even
  parts that could render universally. Wrap only the part that truly needs
  the browser, not its whole parent section.
- **Loaders must be server-safe: no `window`, `document`, `localStorage`.**
  Run `pnpm test:ssr-import` after touching a `server.ts` or a service it
  depends on — it fails loudly if a browser global leaks into the server
  bundle.
- **Don't assume a loader ran.** Always code the CSR fallback path in
  `script.ts` (`getProps()` returned nothing → fetch client-side) — a slow
  loader gets abandoned after `abortTimeoutMs`, and the page still has to
  work.
- **Test with JS disabled**, not just View Source. It's the fastest way to
  catch a widget that silently depends on client-only rendering without being
  marked `client-only`.
