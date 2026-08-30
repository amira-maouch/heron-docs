---
sidebar_position: 1
---

# App Structure

A Heron app is a folder of **config + JSON widget trees**. The framework
(`@heron-ws/app-runtime`) supplies the router, renderer, and dev/prod servers;
your app supplies config, routes, widgets, and styling. This page walks every
file and folder you'll actually touch, using a real app (`alefbab_app`) as the
example.

```
my-app/
├── app.config.ts          # framework config: paths, locales, ssr, auth
├── vite.config.ts         # Vite config (delegates to createViteConfig)
├── app-manifest.json      # routes → widgets, root layout, theme, 404
├── .bundle-lock.json       # pinned versions of registry components/services
├── package.json
├── index.html
├── index.css               # Tailwind/Bootstrap/etc. entry
├── main.tsx                 # trivial — mounts the shell
├── middlewares/             # page-lifecycle guards (auth, service init...)
├── themes/                  # color theme JSON files
├── translations/            # app-level i18n namespaces
└── widgets/                 # your actual pages and components
    ├── root/                 # app-wide layout (always rendered)
    ├── layouts/               # named layouts routes can opt into
    └── pages/                 # one folder per route
        └── some-page/
            ├── metadata.json    # the widget's component tree (required)
            ├── script.ts        # client behavior (optional)
            ├── server.ts        # SSR data loader (optional)
            ├── styles.css       # scoped extra CSS (optional)
            └── translations/_self/{en,ar}.json
```

## `app.config.ts`

The root config the CLI/dev-server/build read. Real example:

```ts
export default defineConfig({
  metadataDir: ALEFBAB_ROOT,
  middlewaresDir: path.join(ALEFBAB_ROOT, "middlewares"),
  localization: {
    defaultLocale: "en",
    fallbackLocale: "en",
    supportedLocales: ["en", "ar"],
  },
});
```

- `metadataDir` — the app root: where the runtime looks for `widgets/`,
  `app-manifest.json`, `themes/`, `translations/`.
- `middlewaresDir` — folder scanned for `@Middleware(...)` files.
- `localization` — default/fallback/supported locales.

Two more fields exist but are opt-in — see
[Authentication & Authorization](/docs/guides/backend-and-auth/authentication-and-authorization)
for `authorization`, and [Using SSR](/docs/guides/ssr/using-ssr) for `ssr`.

## `vite.config.ts`

Almost everything is delegated to the framework:

```ts
import { createViteConfig } from "@heron-ws/app-runtime";
import egretConfig from "./app.config.js";
import tailwindcss from "@tailwindcss/vite";

export default createViteConfig({
  root: __dirname,
  egretConfig,
  plugins: [tailwindcss()], // add your CSS lib's plugin here
});
```

## `app-manifest.json`

Maps URL slugs to widget folders. See
[How to Add a Route](/docs/guides/widgets/how-to-add-a-route) for the full breakdown.

```json
{
  "routing": { "appPathPrefix": "app" },
  "root": "root",
  "theme": "sky",
  "errorRoutes": { "404": { "widget": "pages/errors/not-found" } },
  "routes": {
    "dashboard": {
      "widget": "pages/dashboard",
      "layout": "layouts/main-layout",
      "title": "Dashboard"
    }
  }
}
```

## `.bundle-lock.json`

A lockfile — like `package-lock.json`, but for **registry components and
services** (`shadcn:*`, `ui:*`, `egret-ui:*`, your app's own namespace). It
pins exactly which versions of each vendored component/service bundle your
build resolved to, so builds are reproducible. You don't hand-edit it; it's
written by the build tooling when you add/update a registry component.

## `middlewares/`

Files here register **page-lifecycle guards** — code that runs on every
client-side navigation, before the page renders (auth checks, service setup).
See [How to Create a Middleware](/docs/guides/setup/how-to-create-a-middleware).

## `themes/`

One JSON file per color theme (light + dark CSS variable sets). The active
theme is set in `app-manifest.json`'s `"theme"` field and switchable at
runtime via `$egret.theme`. Real excerpt, `themes/sky.json`:

```json
{
  "name": "sky",
  "label": "Sky",
  "light": { "--primary": "#0969da", "--background": "#ffffff", "..." : "..." },
  "dark": { "--primary": "#38bdf8", "--background": "#0c1e2e", "..." : "..." }
}
```

## `widgets/`

The actual app content. Each **widget** is a folder with:

| File | Required? | Purpose |
|---|---|---|
| `metadata.json` | Yes | The component tree — what renders |
| `script.ts` | No | Client-side behavior, wired via `$egret`/`$self` |
| `server.ts` | No | Server-side data loader (see [How to Add a Widget Data Loader](/docs/guides/widgets/widget-data-loaders)) |
| `styles.css` | No | Extra scoped CSS beyond utility classes (see [Using styles.css](/docs/guides/widgets/using-styles-css)) |
| `translations/_self/{locale}.json` | No | Strings scoped to this widget |
| `contract.json` | No | Declares public `methods`/`events` other widgets can call/listen to (see [Widget Scripts & APIs § Exposing methods and events](/docs/guides/widgets/widget-scripts-and-apis#exposing-methods-and-events-to-other-widgets)) |

One widget is special: `widgets/root/` wraps every single route and holds
app-wide providers (toasts, dialogs, i18n) — see
[The Root Layout](/docs/guides/widgets/root-layout).

For everything else about widgets — when to make a new one, how components
and aliases work, what APIs `script.ts` can call — see
[How to Add a Widget](/docs/guides/widgets/how-to-add-a-widget) and
[Widget Scripts & APIs](/docs/guides/widgets/widget-scripts-and-apis).

## `translations/` (app level)

Shared i18n namespaces every widget can pull from — `common`, `actions`,
`errors`, `validation`, plus one folder per registry component that ships its
own strings. See [How to Add Translations](/docs/guides/widgets/how-to-add-translations).

## `index.css`, `index.html`, `main.tsx`

`main.tsx` is deliberately trivial:

```tsx
import "@heron-ws/app-runtime/shell";
import "./index.css";
```

The framework's shell handles mounting React, routing, and providers — your
app only supplies global CSS. `index.css` is where you wire up Tailwind,
Bootstrap, or any other CSS approach — see
[Styling Libraries](/docs/guides/styles/tailwind).

## Debugging

Ran into a blank subtree, a page stuck loading, or a script that silently
never runs? See [Debugging Heron Apps](/docs/guides/debugging).
