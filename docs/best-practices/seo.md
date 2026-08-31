---
sidebar_position: 1
---

# SEO Best Practices

- **Only enable SSR + indexing for routes that need it.** Authenticated
  dashboards shouldn't be in the sitemap — give them `"seo": { "index": false }`
  or leave them off `ssr` entirely rather than relying on `robots.txt` alone.
- **Let route/loader `seo` do the work, don't hand-write `<head>` tags** in a
  widget script. The four-layer resolver (see
  [Adding SEO to Pages](/docs/guides/ssr/seo)) exists so title/description/OG/Twitter
  stay consistent — bypassing it produces pages that pass a manual check but
  drift from the rest of the site.
- **Never let a loader control `canonical` or `robots`.** The framework caps
  these at the app/route level on purpose — don't try to work around that by
  string-building your own `<link rel="canonical">` client-side.
- **Verify with `curl`, not just DevTools.** DevTools shows the post-hydration
  DOM; crawlers see the raw server response. `curl` the route and check the
  actual HTML.
- **Remember: no JSON-LD support yet.** If a page needs structured data
  (recipe, product, article schema), that's not covered by the built-in SEO
  resolver — track it as a gap, don't assume it's handled.
- **Use `t:ns.key` for SEO strings instead of hand-branching on locale.**
  `title`/`description`/`keywords`/OG/Twitter values resolve per-request
  automatically when written as a translation reference — see
  [Translated SEO strings](/docs/guides/ssr/seo#translated-seo-strings).
  Don't reimplement locale switching yourself in a loader.
- **Non-production always disallows crawling.** Don't manually add
  `robots.txt` overrides per environment — this is already handled.
