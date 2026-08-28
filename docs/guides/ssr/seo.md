---
sidebar_position: 3
title: Adding SEO to Pages
---

# Adding SEO to Pages

SEO metadata resolves in four layers, each overriding the one before it, then
gets written into `<head>` at render time.

| Layer | Source | Wins for |
|---|---|---|
| 1 | Page title fallback | Title only, lowest priority |
| 2 | `app-manifest.json` — app-level `seo`, then route-level `seo` | Static defaults |
| 3 | Fields derived from the loader's returned entity | Dynamic content pages |
| 4 | An explicit `seo` object returned by `server.ts` | Highest — but not `canonical`/`robots` |

`canonical` and `robots` are deliberately capped at the app/route level (layer
2) — request-derived data can never make protected content indexable, even if
a loader tries to.

## App and route level

```json
{
  "title": "My App",
  "seo": { "description": "Default description", "robots": "index, follow" },
  "routes": {
    "products/:id": {
      "widget": "pages/product",
      "title": "Product",
      "seo": {
        "canonical": "/products",
        "openGraph": { "type": "product" }
      }
    }
  }
}
```

Title/description/image set here also get auto-mirrored into Open Graph and
Twitter tags, and `hreflang` alternates get generated for every supported
locale automatically.

## From a loader (per-request, dynamic)

```ts
// widgets/pages/product/server.ts
export async function loader(ctx: ServerContext) {
  const product = await fetchProduct(ctx.params.id);
  return {
    product,
    seo: {
      title: product.name,
      description: product.shortDescription,
      image: product.heroImageUrl,
    },
  };
}
```

## robots.txt and sitemap.xml

Generated automatically from your manifest — a route is excluded from the
sitemap if it has a `can` declaration (authenticated) or sets
`"seo": { "index": false }`. Non-production environments always serve
`Disallow: /` in `robots.txt`, so staging never gets indexed by accident.

## What's not supported (yet)

No structured data / JSON-LD (`application/ld+json`) generation exists —
current SEO coverage is title, meta description, canonical, hreflang,
Open Graph, and Twitter tags, plus robots.txt/sitemap.xml.

## Verifying it

```bash
curl -sS http://localhost:5173/products/123 | grep -E '<title>|<meta|rel="canonical"'
```

Best practices: [SEO Best Practices](/docs/best-practices/seo).
