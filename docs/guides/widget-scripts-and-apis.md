---
sidebar_position: 2
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
| `can(action, subject, resource?)` | Authorization check — see [Authentication & Authorization](/docs/guides/authentication-and-authorization) |

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
| i18n     | `t(key)`, `language`, `onLanguageChange(cb)`, `i18n.changeLanguage(locale)`        |
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

## Calling your backend: `egretClient`

Most widgets talk to a backend through the `egretClient` service (initialized
once by a [middleware](/docs/guides/how-to-create-a-middleware), then reused
everywhere):

```ts
const client = $egret.getService("egretClient");
await client.listDocuments("contracting.contract", { pageLength: 20 });
await client.runCommand("users.deactivate_user", {}, { aggregateId: userId });
await client.runQuery("reporting.summary", { from: "2026-01-01" });
```

See [How to Wire Heron to an Egret Backend](/docs/guides/how-to-wire-egret-backend)
for the full request/response shape.

## Toasts

```ts
const toaster = $egret.getInstance("app-root.app-toaster");
toaster?.success("Saved");
toaster?.error("Could not save");
```

## Registering a public method

If another widget needs to call into yours, declare the method in your
widget's contract and register it:

```ts
$self.registerMethod("refresh", async () => {
  await loadData();
});
```
