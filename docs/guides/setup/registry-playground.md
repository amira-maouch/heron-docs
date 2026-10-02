---
sidebar_position: 2.5
---

# The Registry Playground

The playground is a page served by the registry itself
(`http://localhost:4100/playground`) where you can open any registry component,
render it, change its props, and check that it behaves before an app ever
vendors it. It loads components exactly the way an app does — the built ESM
graph, the component's own CSS, the shared React/i18n/page-engine runtime — so
what works there works in an app.

Use it when you add or change a component, when you review someone else's
component, and when an app reports "component X looks wrong" and you want to
see X on its own.

## Running it

From `heron_registry/apps/registry`:

```bash
pnpm build             # the registry: the playground renders built graphs
pnpm playground:build  # the playground page itself
pnpm start             # serves http://localhost:4100/playground
```

While the server runs, editing a component's source rebuilds its namespace and
reloads the preview (set `PLAYGROUND_DEV=0` to turn that off). Use
`pnpm playground:dev` instead of `playground:build` if you are changing the
playground itself.

Every view is a link: the component, example, props you changed, viewport,
theme, direction and version are all in the URL. **Copy link** in the header
copies it — paste that into a bug report instead of a screenshot.

## The layout

- **Left** — every component of every registry, with search and filters
  (registry, web/native, tag).
- **Centre** — the preview frame. Above it: the example picker, viewport
  (mobile 375 / tablet 768 / desktop 1280, or any width), palette, light/dark
  theme, theme CSS, LTR/RTL, and the translation view (source strings,
  pseudo-locale, raw keys).
- **Right** — panels:

| Panel | What it is for |
|---|---|
| **Props** | A form generated from the contract's prop schema — nested objects and arrays included. Each optional prop has a **set** checkbox; unset means the component gets nothing, exactly like metadata that omits it. **JSON** switches a field to raw JSON. |
| **JSON** | The props as JSON. |
| **Metadata** | The `metadata.json` node(s) for what you see, ready to paste into a widget. |
| **About** | The contract: description, events, methods, providers, styling. |
| **Activity** *(Advanced)* | Events the component emitted and their payloads. |
| **Methods** *(Advanced)* | Call the component's `useEnhanceAPI` methods with arguments and see the result. |
| **Theme CSS** *(Advanced)* | The stylesheets the component loaded, its styling mode, token overrides, a simulated host page, and the leak check (below). |
| **Composition** *(Advanced)* | Where a compound part sits in its family and which ancestors it accepts. |
| **Health** *(Advanced)* | Props the component *read* but its contract does not declare, and other contract problems found while it rendered. |

**version / compare** in the header render a published release instead of the
current build, or two side by side — useful to see exactly what changed
between `1.2.0` and `1.3.0` before an app updates.

## Examples (stories)

What the preview renders first comes from the component's examples. In order of
preference:

1. **`editor.examples` in `contract.json`** — named presets: props, optional
   child nodes, and more.

   ```jsonc
   "editor": {
     "examples": [
       {
         "id": "en-ar",
         "title": "English / Arabic",
         "props": {
           "variant": "icon",
           "languages": [
             { "code": "en", "name": "English", "direction": "ltr" },
             { "code": "ar", "name": "Arabic", "nativeName": "العربية", "direction": "rtl" }
           ]
         }
       }
     ]
   }
   ```

   An example can also set `viewport`, `theme`, `tags`, request `stubs` (canned
   responses for the URLs the component fetches), and `calls` — methods the
   playground calls once the component has mounted, so an imperative component
   shows something:

   ```jsonc
   { "id": "stack", "title": "Toast stack",
     "calls": [
       { "method": "success", "args": ["Changes saved"] },
       { "method": "error", "args": ["Upload failed"], "delayMs": 250 }
     ] }
   ```

2. **`playground/examples.json` next to the contract** — the same examples as a
   separate file, with `$fixture` references to JSON under `playground/fixtures/`
   for large data. Its `component.version` must equal the contract's version;
   the build tells you when it does not.

3. **`editor.anatomy` on a compound family's root** — the full tree of a
   family (a dialog with its trigger, content, header, title, footer). Each part
   marks its place with `editor.anchor`, and opening any part renders the whole
   family with that part outlined. A part that fits under several ancestors gets
   a **Render inside** picker.

4. **Generated** — with nothing authored, the playground builds an example from
   the contract (labelled *generated story*). It leaves controlled props unset
   (`checked` next to `defaultChecked`, `open` on a dialog) so the component
   stays interactive. Treat it as a smoke test, not documentation — write a real
   example.

Keep example values **uncontrolled** when you want people to interact: an
example that sets `value` on an OTP input or `checked` on a switch freezes it.

## Things the playground does for you

- **Providers.** A component that needs a context (a tooltip needs
  `TooltipProvider`, a sidebar part needs `SidebarProvider`) lists it in
  `requires.providers`; the preview wraps the tree in it automatically. Provider
  components themselves (`"role": "provider"`) are not rendered alone — you get
  a page listing the components that use them.
- **Host-only props.** Props whose type is a live DOM object or ref (a portal
  `container: HTMLElement`) have no control — only code can pass one.
- **Each component's CSS, nothing else.** The frame has a neutral token sheet
  (`--background`, `--primary`, …) and no app CSS, so a component that looks
  right here brings everything it needs.

## Checking styling

Open **Theme CSS** (under *Advanced…*) to see how the component fits into a host app:

- **Styling mode** from the contract — *host-themed* (follows the app's tokens:
  edit them in the token panel and watch it follow), *self-styled* (fixed look,
  not themable), or *headless* (brings no CSS; pick a host sheet to style it).
- **Host page** — render the component on a simulated **Tailwind** or
  **Bootstrap** page.
- **Check leaks** — compares computed styles with and without the component's
  CSS (does the component restyle the host?) and with and without the host
  sheet (does the host restyle the component?). Both lists should be empty.

## Troubleshooting

| You see | Usually means |
|---|---|
| "Registry component failed: … must be used within `XProvider`" | A missing `requires.providers` entry — run `pnpm contract:sync`, which renders the component and records the providers it needs. |
| A blank preview for a sidebar or similar responsive component | The frame is narrower than the component's desktop breakpoint. Pick **desktop** or widen the window. |
| A control that does nothing when clicked | The example sets the controlled prop (`checked`, `value`, `open`). Unset it or use the `default…` prop. |
| "Manifest version X does not match …" | `playground/examples.json` was not updated after a version bump. |
| Unstyled, serif text | The frame's base reset is off for the selected theme profile — switch the toolbar's **Theme CSS** profile to Tailwind. |
