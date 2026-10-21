---
sidebar_position: 1.5
---

# How to Connect a New App to the Registry

A new consumer app needs two things before `pnpm build` can vendor registry
components:

1. **its own registry token** — issued by the registry administrator; and
2. **the registry's public release key** — the same key every app pins.

A React Native app also needs **its own OTA bundle signing key**, covered in
[Sign Native OTA Bundles](/docs/guides/setup/sign-native-ota-bundles).

For why each piece exists, see
[Registry Tokens and Release Signing](/docs/explanation/registry-tokens-and-release-signing).

:::caution[Never reuse another app's token]

Each app gets its own consumer record and token. Reusing another app's token
ties the two apps' access, rotation and revocation together, and it widens
what a leak of either one exposes.

:::

## 1. Request a registry token

Send the registry administrator:

- a **consumer ID** for the app — lowercase letters, digits and hyphens, for
  example `myapp-web-ci`. Choose it carefully: it is embedded in the token and
  cannot be renamed later without issuing a new token;
- the **registries** the app needs — only those, for example
  `default,ui,shadcn,egret-ui` for a web app or
  `mobile-ui,mobile-services` for a native content server;
- an optional expiry date.

The administrator follows
[Issue a token for a new app](/docs/guides/setup/manage-registry-consumers-and-signing-keys#issue-a-token-for-a-new-app)
and hands you the `hrt_myapp-web-ci_…` token once, over a private channel.

The token works only after the administrator's `consumers.json` change is
deployed to `registry.heron.ws`. Until then every request returns `401`.

## 2. Store the token

**CI.** Add it as a repository secret, either in **Settings → Secrets and
variables → Actions**, or from a terminal (paste the token at the prompt — do
not put it on the command line):

```bash
gh secret set HERON_REGISTRY_TOKEN -R <org>/<myapp-repo>
```

Expose it only on the step that runs the component build:

```yaml
- name: Build
  env:
    HERON_REGISTRY_TOKEN: ${{ secrets.HERON_REGISTRY_TOKEN }}
  run: |
    test -n "$HERON_REGISTRY_TOKEN" || { echo "::error::HERON_REGISTRY_TOKEN is required"; exit 1; }
    pnpm build
```

**Local.** Put it in the app's gitignored `.env.local`:

```dotenv
HERON_REGISTRY_TOKEN=hrt_myapp-web-ci_…
```

Confirm `.env.local` is listed in `.gitignore` before saving the file. Never
commit the token, and never put it in `bundle-manifest.json`, a workflow file
or a tracked `.env` file.

## 3. Pin the public release key

Add the registry URLs and `trustedReleaseKeys` to `bundle-manifest.json`. List
the same registries in both places:

```json
{
  "registries": {
    "default": "https://registry.heron.ws/api/v2/registries/default",
    "ui": "https://registry.heron.ws/api/v2/registries/ui",
    "shadcn": "https://registry.heron.ws/api/v2/registries/shadcn",
    "egret-ui": "https://registry.heron.ws/api/v2/registries/egret-ui"
  },
  "trustedReleaseKeys": [
    {
      "keyId": "registry-release-2026",
      "publicKey": "MCowBQYDK2VwAyEA9ZAe7tQchbaF4v4FlLoiasoUBjBOX+UCBwZqBjlVZjs=",
      "registries": ["default", "ui", "shadcn", "egret-ui"]
    }
  ],
  "components": {},
  "services": {}
}
```

The public key is not a secret; commit it.

Take the key from a trusted source: an existing app's committed
`bundle-manifest.json`, or the `registry-public-trust-<commit>` artifact of a
successful `heron_registry` deployment:

```bash
gh run list -R white-stork/heron_registry -w registry-cicd.yaml -s success -L 1
gh run download <run-id> -R white-stork/heron_registry -n registry-public-trust-<commit>
cat release-public-trust.json   # { "keyId": "…", "publicKey": "…" }
```

Do not copy a key from a registry API response. The point of pinning is that
the registry cannot choose which key the app trusts.

## 4. Check the token

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "X-Registry-Token: $HERON_REGISTRY_TOKEN" \
  https://registry.heron.ws/api/v2/registries/ui/components/bundle
```

| Result | Meaning |
| --- | --- |
| `200` | Token accepted for that registry |
| `401` | Wrong token, or its hash is not deployed yet |
| `403` | Token valid, but the registry is not in its scope — ask the administrator to add it |

## 5. Build and commit the lock

Run a strict build — with neither `HERON_ALLOW_UNSIGNED_COMPONENTS` nor
`HERON_ALLOW_INSECURE_REGISTRIES` set:

```bash
pnpm heron-build-components --update
```

Every entry in the new `.bundle-lock.json` should carry
`"releaseSignatureKeyId": "registry-release-2026"`. Commit the lock. CI then
builds against it with `--frozen-lockfile`.

## Troubleshooting

| Error | Cause |
| --- | --- |
| `HTTP 401 fetching …` | Token missing from the build step's `env`, wrong token, or its `consumers.json` change not deployed |
| `HTTP 403 fetching …` | Registry missing from the consumer's scope |
| `HTTP 503 fetching …` with `The requested release is not signed…` | The selected release was published but has not been signed by a registry deployment yet |
| `Component release was signed by untrusted key "<id>" for registry "<r>"` | `trustedReleaseKeys` lacks that key ID, or does not list that registry under it |
| `Component release signature verification failed` | Wrong `publicKey` for the key ID, or tampered release |
| `Registry "<r>" must use HTTPS…` | A registry URL is `http://`. Only local development may opt in, with `HERON_ALLOW_INSECURE_REGISTRIES=1` and a localhost URL |
| `--frozen-lockfile: "<key>" … has no up-to-date lock entry` | The committed lock was written by a build that skipped verification, or the manifest changed. Refresh it with a strict `--update` build and commit |

For local registry development, see
[Running Heron Locally](/docs/guides/running-locally).
