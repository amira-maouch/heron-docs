---
sidebar_position: 8
---

# How to Add Translations

Translations live in two places: **widget-scoped** (`_self`) and
**app-level** (shared namespaces).

## Widget-scoped translations

```
widgets/pages/auth/login/translations/_self/
├── en.json
└── ar.json
```

```json
// en.json
{
  "title": "Welcome back",
  "sign_in": "Sign in",
  "validation_email_required": "Please enter your email address."
}
```

Reference it two ways:

```json
// metadata.json — declarative
{ "props": { "children": "t:pages/auth/login.sign_in" } }
```

```ts
// script.ts — imperative
showError($self.t("validation_email_required"));
```

## App-level translations

Shared namespaces any widget can pull from, at `translations/<namespace>/{locale}.json`:

```
translations/
├── _default/{en,ar}.json     # fallback namespace
├── common/{en,ar}.json         # shared UI strings (Save, Cancel, ...)
├── actions/{en,ar}.json
├── errors/{en,ar}.json
└── validation/{en,ar}.json
```

Real excerpt, `translations/errors/en.json`:

```json
{
  "network": {
    "offline": "You are currently offline",
    "timeout": "Request timed out"
  },
  "auth": {
    "unauthorized": "You are not authorized to perform this action",
    "sessionExpired": "Your session has expired"
  }
}
```

Reference an app-level namespace with `t:<namespace>.<key>`:

```json
{ "props": { "children": "t:_default.brand_name_title" } }
```

## Loading extra namespaces at boot

The shell only preloads `common` and `actions` automatically. If your widgets
need `components`, `validation`, or `errors` strings (form-field labels,
validation messages), load them once in `widgets/root/script.ts`:

```ts
const rootScript = ($egret: EgretRuntime) => {
  void $egret.i18n.loadNamespaces(["components", "validation", "errors"]);
};
export default rootScript;
```

Without this, those namespaces' `t()` calls render the raw key instead of the
translated string.

## Switching language at runtime

```ts
await $egret.i18n.changeLanguage("ar");
$egret.language; // "ar"
$egret.onLanguageChange((lang) => { /* re-render anything that needs it */ });
```

## Interpolation

```json
"sessions_remaining": "{{count}} recovery codes remaining"
```
```ts
$self.t("sessions_remaining", { count: 3 });
```
