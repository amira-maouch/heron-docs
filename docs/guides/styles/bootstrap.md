---
sidebar_position: 2
title: Bootstrap
---

# Using Bootstrap

`bootstrap_app` uses Bootstrap 5 instead of Tailwind — a full stylesheet
rather than utility classes. The two approaches aren't mixed in a single app
in practice; pick one per app.

## 1. Dependency

```json
// package.json
"dependencies": { "bootstrap": "^5.3.8" }
```

## 2. `index.css`

Import the built stylesheet, then bridge Heron's theme variables onto
Bootstrap's own CSS variable names so Bootstrap components respond to theme
switches automatically:

```css
@import "bootstrap/dist/css/bootstrap.min.css";

/* Egret theme → Bootstrap variable bridge.
 * The theme engine sets --primary, --background, etc. on
 * <html class="theme-sky light">. Map them onto Bootstrap's own vars. */
:root,
html[class*="theme-"] {
  --bs-body-bg: var(--background);
  --bs-body-color: var(--foreground);
  --bs-border-color: var(--border);
  --bs-primary: var(--primary);
  --bs-danger: var(--destructive);
  --bs-card-bg: var(--card);
}
```

## 3. Using it in a widget

```json
{
  "component": "egret:core:div",
  "id": "login-card",
  "props": { "className": "card shadow-sm border-0", "style": { "maxWidth": "420px" } }
}
```

Companion `styles.css` for anything Bootstrap's own classes don't theme
correctly out of the box:

```css
/* widgets/pages/login/styles.css */
.card {
  background-color: var(--card);
  color: var(--card-foreground);
  border-color: var(--border);
}
.text-muted { color: var(--muted-foreground) !important; }
```

## Dev-mode note

Because Bootstrap ships as one big stylesheet (not JIT-generated per-page like
Tailwind), `bootstrap_app`'s `vite.config.ts` adds a small dev-only plugin
that injects a render-blocking `<link>` for `index.css`, so Bootstrap styles
apply before first paint in development instead of flashing unstyled content.
