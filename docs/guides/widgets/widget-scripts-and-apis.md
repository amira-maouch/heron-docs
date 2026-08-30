---
sidebar_position: 6
---

# Widget Scripts & APIs

A widget's `script.ts` default-exports a function that gets `eval`'d as
`function($egret, $self) { ... }` once the widget's whole tree is mounted.

```ts
const myScript = ($egret: any, $self: any) => {
  // runs once, after every child in this widget has emitted component_ready
};
export default myScript;
```

## `$self` — this widget's own handle

| Method                            | Use it for                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `getChild(alias)`                 | Get a child by its `metadata.json` `alias` (e.g. `"@saveBtn"`)                                            |
| `getProps()` / `setProps(props)`  | Read/merge this widget's own props                                                                        |
| `emit(event, data?)`              | Emit a public event from this widget                                                                      |
| `t(key, options?)`                | Translate against this widget's `translations/_self/`                                                     |
| `listen(handlers)`                | Bulk-attach DOM handlers to a child                                                                       |
| `can(action, subject, resource?)` | Authorization check — see [Authentication & Authorization](/docs/guides/backend-and-auth/authentication-and-authorization) |

Real usage, `bootstrap_app`'s dashboard widget:

```ts
$self.getChild("@saveBtn")?.listen({ onClick: () => save() });
$self.getChild(`@taskRow${n}`)?.setProps({ className: rowClassName(n) });
```

`listen()` **overwrites** the handlers for a given event name rather than
adding to them — call it once per child, not repeatedly.

## `$egret` — the app-wide runtime

| Area     | Members                                                                            |
| -------- | ---------------------------------------------------------------------------------- |
| Lookup   | `getInstance(id)`, `has(id)`, `list()`                                             |
| Events   | `addEventListener`, `emitComponentEvent`, `events.registerComponent(id, handlers)` |
| i18n     | `t(key)`, `language`, `onLanguageChange(cb)` — see [`$egret.i18n`](#egreti18n) below |
| Services | `getService(name)`, `hasService(name)`, `initService(name, config)`                |
| Theme    | `theme.setTheme(name, mode?)`, `theme.toggleMode()`, `theme.getState()`            |
| Page     | `getPageParams()`, `page.setDocumentTitle(title)` (route widget only)              |
| Env      | `getEnv("EGRET_...")`                                                              |
| Auth     | `auth.can(action, subject)`, `auth.getAccessToken()`                               |

Real usage:

```ts
// alefbab_app/widgets/shell/sidebar-menu/script.ts
label: $self.t("nav_dashboard"),
```

```ts
// alefbab_app/widgets/pages/system/user-settings/script.ts
const client = $egret
  .getService("egretClient")
  .withConfig({ apiBaseUrl: authBase });
const res = await client.call("authentication.get_my_profile", {
  kind: "query",
});
```

```ts
// widgets/root/script.ts — app boot
$egret.i18n.loadNamespaces(["components", "validation", "errors"]);
```

## `$egret.i18n`

A dedicated object, not just the top-level `t()`/`language` shortcuts — this
is the full API for reading and reacting to locale state from a script:

| Member | Use it for |
|---|---|
| `i18n.locale` | Current locale code (e.g. `"en"`, `"ar"`) |
| `i18n.direction` | `"ltr"` or `"rtl"` for the current locale |
| `i18n.languages` | The full list of configured languages (code, name, direction, ...) |
| `i18n.t(key, options?)` | Translate — same as the top-level `$egret.t()` |
| `i18n.changeLanguage(locale)` | Switch the active locale (returns a Promise) |
| `i18n.loadNamespaces(namespaces)` | Load additional translation namespaces on demand |
| `i18n.subscribe(listener)` | Run a callback on every locale change; returns an unsubscribe fn |

```ts
if ($egret.i18n.direction === "rtl") {
  // imperative branch — for $select/cases instead, see below
}

const unsubscribe = $egret.i18n.subscribe((locale) => {
  console.log("locale changed to", locale, $egret.i18n.direction);
});
```

Reading `direction`/`locale` this way works from any script. If the same
branch needs to happen **declaratively, inside `metadata.json`** (no script
involved), that's what `$i18n.direction` in a
[`$select`/`cases`](/docs/guides/widgets/metadata-expressions) expression is
for — same underlying state, read through JSON instead of a script.

## Calling a service

`getService`/`hasService` (table above) is how a script reaches an app-wide
singleton — a backend client, most commonly. See
[Services](/docs/guides/setup/services) for how a service gets vendored,
initialized, and called.

## Toasts

```ts
const toaster = $egret.getInstance("app-root.app-toaster");
toaster?.success("Saved");
toaster?.error("Could not save");
```

## Exposing methods and events to other widgets

A widget can expose a real API — methods another widget calls, events it
listens for — so the host never reaches into its internals. Real example,
`alefbab_app`'s `card-list` widget (embedded via `egret:core:section-reference`
wherever a card grid is needed).

### 1. Declare the API in `contract.json`

```json
{
  "artifactType": "widget",
  "methods": {
    "setItems": {
      "description": "Replace the whole list. Returns the new item count.",
      "params": [{ "name": "items", "type": "array" }],
      "returns": { "type": "number" }
    },
    "addItem": {
      "description": "Appends an item. Emits item:added.",
      "params": [{ "name": "item", "type": "object" }],
      "returns": { "type": "array" }
    }
  },
  "events": {
    "card:click": {
      "description": "A card was clicked (which also selects it).",
      "payload": "{ card: CardItem }"
    },
    "selection:change": {
      "description": "The selected card changed.",
      "payload": "{ selectedId: string | null, card: CardItem | null }"
    }
  }
}
```

### 2. Register the methods in the widget's own `script.ts`

```ts
// widgets/sections/common/card-list/script.ts
const cardListScript = ($egret: any, $self: any) => {
  let items: CardItem[] = [];

  $self.registerMethod("setItems", (next: CardItem[]) => {
    items = next;
    render();
    return items.length;
  });

  $self.registerMethod("addItem", (item: CardItem) => {
    items = [...items, item];
    render();
    $self.emit("item:added", { card: item });
    return items;
  });

  // clicking a card both emits AND selects — the host only sees the emit
  function onCardClick(card: CardItem) {
    $self.emit("card:click", { card });
    $self.emit("selection:change", { selectedId: card.id, card });
  }
};
```

### 3. Call it from the host widget

```ts
// widgets/pages/dev/card-list-demo/script.ts
const cardListDemoScript = ($egret: any, $self: any) => {
  const list = () => $self.getChild("@cardListRef.card-list");

  // Sections mount asynchronously — a registered method may not exist on
  // the child instance the instant getChild() resolves it. Poll briefly
  // rather than assuming it's there (unlike setProps, registerMethod calls
  // aren't queued by the deferred-proxy mechanism).
  const whenReady = (fn: (l: any) => void, attempt = 0) => {
    const l = list();
    if (l?.setItems) return fn(l);
    if (attempt < 50) setTimeout(() => whenReady(fn, attempt + 1), 100);
  };

  whenReady((l) => {
    l.setItems(INITIAL_CARDS);
    l.listen({
      "card:click": (p: any) => console.log("clicked", p.card.title),
      "selection:change": (p: any) => console.log("selected", p.selectedId),
    });
  });

  $self.getChild("@btnAdd")?.listen({
    onClick: () => list()?.addItem?.({ id: `c${Date.now()}`, title: "New task" }),
  });
};
```

The host never touches `card-list`'s internal state or DOM — only
`setItems`/`addItem`/... (called) and `card:click`/`selection:change`/...
(listened to). That's the whole point of the contract: the widget can change
its internals freely as long as the declared methods and events keep working.
