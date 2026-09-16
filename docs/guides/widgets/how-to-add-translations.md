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

## First-paint guarantee

Heron completes the namespaces used by a widget before that widget's first
visible client mount:

- SSR embeds the request locale and translation resources in the bootstrap.
  Hydration adopts and primes that exact snapshot; it does not refetch the
  same widget namespaces or replace visible HTML with a translation loader.
- CSR waits for widget `_self`, `_default`, component bundles, and declared
  component translation overrides before revealing the widget.
- Mobile applies the same gate and also waits for its widget stylesheet.
- On web, `$heron.i18n.changeLanguage()` loads the next language before
  committing it, so the previous translated UI stays visible rather than
  flashing keys.

This guarantee covers declared resources. A missing key is still a missing
key and follows the configured i18n fallback chain.

## Loading extra namespaces at boot

The shell only preloads `common` and `actions` automatically. If your widgets
need `components`, `validation`, or `errors` strings (form-field labels,
validation messages), load them once in `widgets/root/script.ts`:

```ts
const rootScript = ($heron: HeronRuntime) => {
  void $heron.i18n.loadNamespaces(["components", "validation", "errors"]);
};
export default rootScript;
```

Namespaces requested imperatively by a later script are outside the initial
widget resource set. Await them before showing UI that depends on them.

## Switching language at runtime

```ts
await $heron.i18n.changeLanguage("ar");
$heron.i18n.locale; // "ar"
$heron.i18n.direction; // "rtl"
```

## Wiring a language control and direction

Whether you use Heron's dropdown or build your own controls, keep one source
of truth for locale state.

### Shared setup

Declare the app's languages in `app.config.ts`. Use valid BCP 47 tags; Heron
derives their display names and text directions with `Intl`:

```ts
export default defineConfig({
  // ...
  localization: {
    defaultLocale: "en",
    fallbackLocale: "en",
    supportedLocales: ["en", "ar", "fr-CA"],
  },
});
```

Then mount the registry i18n provider once in `widgets/root/metadata.json`,
above the app provider and page slot:

```json
{
  "component": "ui:layout:i18n-provider",
  "id": "language-provider",
  "children": [
    {
      "component": "heron:core:app-provider",
      "id": "app-provider",
      "children": [
        { "component": "heron:core:slot", "id": "page-outlet" }
      ]
    }
  ]
}
```

Do not repeat the language catalogue in the provider's props. In a Heron app,
page-engine injects the runtime-owned i18next instance into this specific
provider. It also supplies React i18n context, keeps the document language and
direction aligned during SSR and hydration, and provides direction context to
the registry's Radix-based components.

### Option 1: use Heron's language dropdown

Place the dropdown anywhere below the root i18n provider, usually in a header
or settings widget:

```json
{
  "component": "ui:core:language-dropdown",
  "id": "language-dropdown",
  "props": { "variant": "icon" }
}
```

With no `languages` prop, it reads the catalogue from
`localization.supportedLocales`. Selecting an item calls the shared Heron
language API; no widget script is required. Use `"variant": "button"` for a
labelled trigger.

The optional `languages` prop replaces only the options and presentation for
that dropdown. Every code it contains must still be supported by
`app.config.ts`; this prop is not a second place to configure the app's
locales.

### Option 2: build your own toggle and direction provider

A custom React registry component should use `useLanguage()` from
`@heron-ws/i18n`. Do not create another i18next instance or keep a separate
locale state:

```tsx
"use client";

import { createContext, type ReactNode } from "react";
import { useLanguage, type Direction } from "@heron-ws/i18n";

export function LanguageToggle() {
  const { languageCode, availableLanguages, changeLanguage } = useLanguage();

  return (
    <select
      aria-label="Language"
      value={languageCode}
      onChange={(event) => void changeLanguage(event.target.value)}
    >
      {availableLanguages.map((language) => (
        <option key={language.code} value={language.code}>
          {language.nativeName ?? language.name}
        </option>
      ))}
    </select>
  );
}

export const AppDirectionContext = createContext<Direction>("ltr");

export function AppDirectionProvider({ children }: { children: ReactNode }) {
  const { currentLanguage } = useLanguage();
  const direction = currentLanguage?.direction ?? "ltr";

  return (
    <AppDirectionContext.Provider value={direction}>
      <div dir={direction}>{children}</div>
    </AppDirectionContext.Provider>
  );
}
```

The custom direction provider is only needed when your own design system has
a direction context to feed. Replace the example context and `<div dir>` with
that system's provider. Heron's root i18n provider already manages
`<html lang>`, `<html dir>`, and Radix direction, so do not imperatively write
those values or call a separate direction setter from the toggle.

Keep both custom components below the registry provider. For an app-wide
custom direction provider, the root ordering is:

```text
ui:layout:i18n-provider
└── your-ui:layout:direction-provider
    └── heron:core:app-provider
        └── heron:core:slot
```

If the custom control is assembled from metadata rather than authored as a
React registry component, delegate from its widget script to the same runtime
API:

```ts
const languageToggleScript = ($heron: HeronRuntime, $self: ComponentAPI) => {
  $self.getChild("@arabic")?.listen({
    onClick: () => void $heron.i18n.changeLanguage("ar"),
  });

  const unsubscribe = $heron.i18n.subscribe(() => {
    const direction = $heron.i18n.direction;
    // Update only custom control presentation; Heron updates app direction.
  });

  return unsubscribe;
};
```

Always call `changeLanguage()` rather than the raw i18next instance. Heron's
API preloads the next locale's resources before committing the change,
serializes rapid selections, persists the locale for the next request, and
updates language and direction subscribers together.

## Interpolation

```json
"sessions_remaining": "{{count}} recovery codes remaining"
```
```ts
$self.t("sessions_remaining", { count: 3 });
```
