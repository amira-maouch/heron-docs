---
sidebar_position: 2
---

# Safe HTML Rendering (XSS prevention)

A checklist, not a reference. The one rule behind all of it:

> **Data is text, never markup.** A value from a user, an API, a document
> field, or widget metadata must never be parsed as HTML or executed as code.

Break that rule and you get **stored/DOM XSS**: a value one user can set (a
supplier name, a rule label) runs as JavaScript in another user's browser —
in your origin, with their privileges. Because tokens live where page scripts
can read them, that becomes session theft and account takeover, including
admins. See
[Authentication & Authorization](/docs/best-practices/authentication-and-authorization).

## The sinks to avoid

Never feed **data** into any of these:

| Sink | Why |
| --- | --- |
| `el.innerHTML = …`, `el.outerHTML = …` | parses the string as HTML |
| `el.insertAdjacentHTML(…)` | same |
| `document.write(…)` | same |
| `dangerouslySetInnerHTML` (React) | same |
| `eval(…)`, `new Function(…)` | executes the string as code |

A **constant literal** is fine (`el.innerHTML = ""` to clear, or a fixed
static template). The danger is any **interpolated or variable** value —
`` `<option>${name}</option>` ``, `someVar`, `data.map(...).join("")`.

## The safe toolkit — `@heron-ws/utils`

Import the helpers instead of hand-rolling escaping:

```ts
import { html, setHTML, escapeHtml, sanitize } from "@heron-ws/utils";
```

### `html` — build markup with data auto-escaped

A tagged template: the static parts are trusted (you wrote them), every
`${interpolation}` is HTML-escaped.

```ts
// ✅ safe — a hostile name renders as text, not a tag
setHTML(datalist, rows
  .map((r) => html`<option value="${r.id}">${r.label}</option>`)
  .join(""));
```

```ts
// ❌ vulnerable — the exact bug this replaces
datalist.innerHTML = rows
  .map((r) => `<option value="${r.id}">${r.label}</option>`)
  .join("");
```

### `setHTML(el, trustedHtml)` — the one allowed markup sink

Use it instead of assigning `innerHTML`. It only ever receives a string you
already escaped with `html`/`escapeHtml` or passed through `sanitize`. It is
the single reviewed, lint-disabled sink in the codebase — don't add others.

### `escapeHtml(value)` — escape a single value

For when you're setting one attribute or text node by hand. Prefer DOM
properties where you can — they never parse markup:

```ts
option.value = String(r.id ?? "");   // ✅ .value / .textContent are always safe
option.textContent = r.label;        // ✅
```

### `sanitize(dirtyHtml)` — only for genuine rich HTML

When a feature legitimately needs to render authored HTML (e.g. CMS content),
sanitize it with DOMPurify first — never render it raw. Browser-only; `await`
it. Reach for this rarely; `html` covers the common "interpolate data" case.

```ts
setHTML(el, await sanitize(richHtmlFromCms));
```

## React

React escapes `{value}` by default, so **render data as children/text** and
you're safe:

```tsx
<span>{supplier.name}</span>   // ✅ escaped automatically
```

Avoid `dangerouslySetInnerHTML`. If a feature truly needs it, feed it only
`sanitize()`d HTML, never a raw string.

## The lint rules

The shared ESLint config (`@white-stork/eslint-config`) flags every one of the
sinks above **as a warning**:

- `no-unsanitized/property`, `no-unsanitized/method` — the HTML sinks
- `react/no-danger` — `dangerouslySetInnerHTML`
- `no-eval`, `no-implied-eval`, `no-new-func` — code execution

When you see one, the fix is almost always "switch to `html` + `setHTML`, or to
`.textContent`/`.value`/React children." A warning is a prompt to review, not
an automatic failure.

### Intentionally allowing a sink

If a line is genuinely safe (the value is a constant, or already `sanitize`d),
disable the **specific** rule on that line **with a justification** — never a
bare disable:

```ts
// eslint-disable-next-line no-unsanitized/property -- `trustedHtml` is sanitize()d upstream; see PR #123
el.innerHTML = trustedHtml;
```

The reason is reviewed in the PR. That's the decision point: fix it, or justify
keeping it.

## Checklist

- [ ] No `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` fed by data.
- [ ] No `dangerouslySetInnerHTML` except on `sanitize()`d HTML.
- [ ] No `eval` / `new Function` on anything data-derived.
- [ ] Dynamic rendering goes through `html` + `setHTML`, `.textContent`/`.value`, or React children.
- [ ] Any lint disable carries a one-line justification.
