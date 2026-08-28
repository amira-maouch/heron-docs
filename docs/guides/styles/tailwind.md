---
sidebar_position: 1
title: Tailwind CSS
---

# Using Tailwind CSS

Tailwind v4 is the default across most consumer apps (`alefbab_app`,
`event-chart`, `doubleguard-webapp`, `double-guard-web-demo`). No
`tailwind.config.*` file needed — v4 configures itself from `index.css`.

## 1. Dependencies

```json
// package.json
"dependencies": {
  "@tailwindcss/vite": "^4.3.2"
},
"devDependencies": {
  "tailwindcss": "^4.3.3",
  "tailwindcss-animate": "^1.0.7"
}
```

## 2. Vite plugin

```ts
// vite.config.ts
import { createViteConfig } from "@heron-ws/app-runtime";
import tailwindcss from "@tailwindcss/vite";

export default createViteConfig({
  egretConfig,
  plugins: [tailwindcss()],
});
```

## 3. `index.css`

This is where Tailwind actually gets configured — real excerpt from
`alefbab_app`:

```css
@import "tailwindcss";

/* Tell Tailwind's JIT scanner where to find className usage */
@source "./widgets/**/*.{json,ts,tsx}";
@source "./bundles/**/*.{json,ts,tsx,js}";

@plugin "tailwindcss-animate";
@custom-variant dark (&:is(.dark *));

/* Map the active theme's CSS variables onto Tailwind's color tokens */
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --radius-lg: var(--radius);
  /* ...one line per theme variable, see themes/*.json */
}

@layer base {
  body { @apply bg-background text-foreground; }
}
```

The `@source` globs matter: widget UI is `className` props inside
`metadata.json` files, not JSX, so Tailwind's scanner needs to be told to look
inside `.json` files too, or utility classes used only in widget metadata get
purged.

## 4. Using it in a widget

Classes go directly in `metadata.json` props:

```json
{
  "component": "egret:core:div",
  "id": "login-root",
  "props": {
    "className": "min-h-svh w-full flex items-center justify-center px-4 bg-gradient-to-br from-background via-background to-primary/5"
  }
}
```

For anything Tailwind utilities don't cover cleanly (complex gradients,
`color-mix`), add a widget-scoped `styles.css`:

```css
/* widgets/pages/auth/login/styles.css */
.login-widget [data-slot="card"] {
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--border) 35%, transparent),
    0 16px 40px -24px rgb(0 0 0 / 0.45);
}
```

## Alternative: PostCSS instead of the Vite plugin

`botify-resturant-site` gets the same result without `@tailwindcss/vite`,
using `@tailwindcss/postcss` instead:

```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

Either works — pick the Vite plugin unless you already have a PostCSS
pipeline for something else.
