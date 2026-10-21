---
sidebar_position: 6
---

# How to Sign Native OTA Bundles

A React Native app built on `@heron-ws/app-runtime-native` downloads its
widgets, routes and scripts as **over-the-air content bundles** from its
content server. Each bundle is signed with an Ed25519 key that belongs to the
app, and the device refuses a bundle whose signature does not match the public
key compiled into the app.

This key is unrelated to the registry release key described in
[Registry Tokens and Release Signing](/docs/explanation/registry-tokens-and-release-signing):

| | Registry release key | OTA bundle key |
| --- | --- | --- |
| Signs | Registry component releases | The app's own content bundles |
| Owner | The registry — one key for every app | Each native app — its own key |
| Checked by | The app build (`heron-build-components`) | The device, at runtime |
| Public key lives in | `bundle-manifest.json` → `trustedReleaseKeys` | The native app's source, passed as `bundlePublicKey` |

:::danger[This key can push code to every installed app]

Whoever holds the private key can publish a bundle every installed copy of the
app will run. Protect it like an app-store signing key.

:::

## How it works

`heron-build-bundle` (run by the content server's `build:bundle` script)
packages the bundle and signs its manifest with
`.bundle-keys/private.pem` in the content server's project root. The signature
(`signatureV2`) covers the bundle version, build number, content hash, sizes,
`minAppVersion` and compatibility flags. The content hash in turn covers every
file in the bundle.

On the device, the runtime:

1. verifies `signatureV2` against the app's `bundlePublicKey`;
2. checks that the content hash matches the manifest's file list;
3. checks every extracted file against its entry, and that no unlisted file is
   present.

A bundle that fails any check is not installed.

## Set up a key for a new app

### 1. Generate the key pair

Run the bundle build once in the content server:

```bash
pnpm build:bundle
```

When no `.bundle-keys/private.pem` exists, `heron-build-bundle` creates
`.bundle-keys/private.pem` (mode `600`) and `.bundle-keys/public.pem`, and
prints the raw 32-byte public key in base64:

```text
[build-bundle] generated a new Ed25519 signing keypair at …/.bundle-keys.
  …
  <raw base64 public key>
```

Before committing anything, confirm `.bundle-keys/` is in the content server's
`.gitignore`.

### 2. Commit the public key in the native app

Put the printed key in a tracked file of the native app, for example
`bundleKey.ts`:

```ts
/**
 * Ed25519 public key this app's content bundles are signed with — printed by
 * `pnpm build:bundle` in the content server. Not a secret; the private half
 * lives only in the content server's gitignored .bundle-keys/.
 */
export const BUNDLE_PUBLIC_KEY = "<raw base64 public key>";
```

and pass it to the runtime:

```tsx
import { BUNDLE_PUBLIC_KEY } from "./bundleKey";

<NativeAppShellClient
  apiBaseUrl={apiBaseUrl}
  bundlePublicKey={BUNDLE_PUBLIC_KEY}
  appVersion={appVersion}
/>
```

Keep the key in a committed file, not in `.env.local`. A fresh clone without
the key would build an app that cannot verify any bundle.

:::caution[Always pass `bundlePublicKey`]

When the prop is omitted, the runtime falls back to a legacy default key that
belongs to a different app. Every bundle signed with your key then fails
verification: the app renders nothing, and the only sign is a
`no bundlePublicKey passed` error in the device log. An empty string disables
verification only in `__DEV__` builds; a release build with an empty key
rejects every bundle.

:::

### 3. Store the private key in CI

Store the file verbatim as a secret of the app repository:

```bash
gh secret set MOBILE_BUNDLE_SIGNING_KEY -R <org>/<myapp-repo> < .bundle-keys/private.pem
```

Also keep an offline backup, for example in the team's password manager.

### 4. Restore the key in the CI build

`heron-build-bundle` generates a **new** key pair whenever none is on disk. In
CI that would sign the bundle with a key no installed app trusts. Restore the
key explicitly, refuse to continue without it, and check that it matches the
committed public key before signing:

```yaml
- name: Build the signed bundle
  working-directory: mobile_app_server
  env:
    BUNDLE_KEY: ${{ secrets.MOBILE_BUNDLE_SIGNING_KEY }}
    HERON_REGISTRY_TOKEN: ${{ secrets.HERON_REGISTRY_TOKEN }}
  run: |
    [ -n "$BUNDLE_KEY" ] || { echo "MOBILE_BUNDLE_SIGNING_KEY is empty"; exit 1; }
    mkdir -p .bundle-keys
    umask 077
    printf '%s\n' "$BUNDLE_KEY" > .bundle-keys/private.pem
    node -e '
      const c = require("crypto"), fs = require("fs");
      const pub = c.createPublicKey(fs.readFileSync(".bundle-keys/private.pem"));
      fs.writeFileSync(".bundle-keys/public.pem", pub.export({ type: "spki", format: "pem" }));
      const der = pub.export({ type: "spki", format: "der" });
      const raw = der.subarray(der.length - 32).toString("base64");
      const want = fs.readFileSync("../mobile_app/bundleKey.ts", "utf8")
        .match(/BUNDLE_PUBLIC_KEY = "([^"]+)"/)[1];
      if (raw !== want) { console.error("signing key does not match bundleKey.ts"); process.exit(1); }
    '
    pnpm build:bundle
    rm -rf .bundle-keys
```

Adjust the paths to your repository layout.

## Changing the key

Installed apps trust only the public key they were built with. If the private
key is regenerated or lost:

1. Generate a new pair (delete `.bundle-keys/` and run `pnpm build:bundle`).
2. Update `BUNDLE_PUBLIC_KEY` **in the same change**, and replace the CI
   secret.
3. Ship a new native build through the app stores.

Until users install that build, their apps reject every bundle signed with
the new key. There is no way to rotate the key over the air, which is why the
offline backup matters.

Rotate the same way if the private key leaks — and treat the leak as an
incident, since the old key keeps working on every installed copy until users
update.
