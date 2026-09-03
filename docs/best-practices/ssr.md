---
sidebar_position: 2
---

# SSR Best Practices

- **Default to CSR.** Turn SSR on per-route, deliberately, for pages where
  first paint or crawlability actually matters. Don't flip the app-wide
  `ssr.default` to `true` just to avoid per-route config.
- **Give every browser-only registry component a presentation contract.** Use
  `layout: "none"` for nonvisual providers/portals. Use `layout: "reserved"`
  with a realistic footprint for visual components. Declare it once in the
  component contract instead of repeating it in every widget. See
  [CSR Placeholders](/docs/guides/ssr/csr-placeholders).
- **Use metadata placeholders only for instance-specific shapes.** They remain
  useful for a chart whose height varies by placement or for a meaningful
  skeleton, and override the registry default.
- **Do not rely on guessed generic heights.** If Heron cannot prove the layout
  is stable, it deliberately chooses an atomic first reveal. This prevents a
  jump but gives up immediately visible partial SSR for that route.
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
- **Throttle JavaScript and the network while testing hydration.** Confirm the
  page never goes visible → loading/empty → visible. Valid sequences are
  loading → visible or server-visible → interactive.
- **Keep first-paint copy declarative.** Put visible initial text in metadata
  translation references or component translation contracts. Widget scripts
  are for behavior after child instances are ready, not for replacing raw keys
  after the first paint.
