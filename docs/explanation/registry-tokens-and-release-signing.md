---
sidebar_position: 2
---

# Registry Tokens and Release Signing

This page explains how a consuming app and the Heron registry trust each other:
what the registry token proves, what the release signature proves, where each
secret lives, and how the build checks them. It is a conceptual explanation.
For the steps, see
[Connect a New App to the Registry](/docs/guides/setup/connect-a-new-app-to-the-registry)
and
[Manage Registry Consumers and Signing Keys](/docs/guides/setup/manage-registry-consumers-and-signing-keys).

## The one-sentence model

**A registry token proves _who may download_; a release signature proves
_what was published_. The token is a per-app secret sent to the registry; the
signature is checked by the app against a public key the app pins in
`bundle-manifest.json`. Both are used only while the app builds — the browser
and the device never receive either.**

The two mechanisms are independent. A valid token does not make an unsigned
release acceptable, and a valid signature does not let an app without a token
download anything.

## Who holds what

| Material | Kind | Held by | Never stored in |
| --- | --- | --- | --- |
| Registry token `hrt_<consumer>_…` | Secret, one per app | The app's CI secret `HERON_REGISTRY_TOKEN` and the developer's gitignored `.env.local` | Git, `bundle-manifest.json`, `.bundle-lock.json`, build output |
| Token hash (SHA-256) | Not secret | `heron_registry/apps/registry/consumers.json` (committed) | — |
| Release signing private key | Secret, one for the registry | `heron_registry` repository secret `HERON_RELEASE_SIGNING_PRIVATE_KEY` | Git, the registry image, release files, any response |
| Release signing key ID | Not secret | `heron_registry` repository variable `HERON_RELEASE_SIGNING_KEY_ID` (currently `registry-release-2026`) | — |
| Release public key | Not secret | Every app's `bundle-manifest.json` → `trustedReleaseKeys` | — |

There is **one release signing key for the whole registry**, shared by every
app. There is **one token per app**. A new app therefore needs a new token, but
copies the existing public key.

:::note[Native OTA bundles use a different key]

React Native apps also sign their own over-the-air content bundles. That key
belongs to the app, not to the registry, and it signs what the app's content
server publishes to devices — not registry releases. See
[Sign Native OTA Bundles](/docs/guides/setup/sign-native-ota-bundles).

:::

## The token: who may download

### Shape

```text
hrt_<consumer-id>_<43 characters of base64url randomness>
```

The consumer ID (for example `myapp-web-ci`) is embedded in the token. Consumer
IDs use lowercase letters, digits and hyphens only, so the first underscore
after `hrt_` always ends the ID.

### What the registry stores

The registry never stores a token. `consumers.json` holds one record per
consumer, with the SHA-256 hash of each of its tokens and the registries it may
read:

```json
{
  "schemaVersion": 1,
  "publicRegistries": [],
  "consumers": [
    {
      "id": "myapp-web-ci",
      "kind": "registry",
      "registries": ["default", "ui", "shadcn", "egret-ui"],
      "hashes": [
        {
          "sha256": "<64 lowercase hex characters>",
          "createdAt": "2026-10-21T00:00:00.000Z",
          "notAfter": null
        }
      ],
      "expiresAt": null,
      "disabled": false
    }
  ]
}
```

### How a request is checked

Every request to `/api/v2/registries/...` carries the token in the
`X-Registry-Token` header. The registry:

1. reads the consumer ID from the token prefix;
2. finds that consumer's record, and rejects it if it is `disabled` or past
   `expiresAt`;
3. hashes the presented token and compares it, in constant time, with each of
   the record's hashes that is not past its `notAfter`;
4. checks that the requested registry is in the record's `registries`, or in
   `publicRegistries`.

| Response | Meaning |
| --- | --- |
| `401` `A valid registry token is required` | No token, malformed token, unknown consumer, wrong hash, expired or disabled |
| `403` `The registry token cannot access this registry` | Valid token, but the registry is outside its scope |
| `503` `Registry authentication is not configured` | The registry has no consumer configuration (local development only — production refuses to start) |
| `410` | The retired `/api/registries/...` API. Use `/api/v2/registries/...` |

"Public" registries in `publicRegistries` are shared by every _authenticated_
consumer. They are never readable anonymously.

### Consequences worth knowing

- **The consumer ID is part of the token.** Renaming a record in
  `consumers.json` invalidates every token issued under the old name, and the
  CI secret starts receiving `401`.
- **Replacing a hash kills the old token immediately.** Rotate by adding the
  new hash next to the old one, switching the app over, and only then removing
  the old hash.
- **`consumers.json` is re-read when it changes.** An invalid edit is rejected
  and logged; the last valid configuration stays active.

## The signature: what was published

### What gets signed

Publishing a release writes an immutable release manifest — the component's
coordinate, version, contract hash, and the hash and size of every artifact
file. When the release is signed, a sidecar `<version>.signature.json` is
written next to it:

```json
{
  "schemaVersion": 1,
  "kind": "component-release-signature",
  "algorithm": "Ed25519",
  "keyId": "registry-release-2026",
  "manifestSha256": "<sha256 of the manifest>",
  "signature": "<base64 Ed25519 signature>"
}
```

`manifestSha256` is the SHA-256 of the manifest serialised as key-sorted,
two-space-indented JSON. The signed bytes are:

```text
heron-component-release-v1
<manifestSha256>
```

Namespace-wide and registry-wide aggregate releases (`"ui/display": "*"`,
`"shadcn": "*"`) are signed the same way.

### Where signing happens

Developers publish **unsigned** release candidates with
`pnpm publish:components`. Signing happens in the registry's deployment
workflow, on the CI runner: it runs `sign:existing-releases` with the private
key from the repository secret, then builds the registry image. The private key
is not copied into the image.

The same workflow uploads a `registry-public-trust-<commit>` artifact that
contains only the key ID and the public key. That artifact is the trusted
source of the public key that apps pin.

### What the registry serves

The v2 release endpoints return the manifest, its hash and its signature
together:

```json
{ "signedManifest": { … }, "manifestHash": "<sha256>", "signature": { … } }
```

v2 never serves an unsigned release. A request that resolves to an unsigned
release returns `503` with
`The requested release is not signed and is unavailable through registry API v2`.
A component published but not yet signed by a registry deployment is
therefore not downloadable through v2.

## How the app build verifies a release

`heron-build-components` (part of `@heron-ws/app-runtime-server`) loads
`trustedReleaseKeys` from `bundle-manifest.json`:

```json
"trustedReleaseKeys": [
  {
    "keyId": "registry-release-2026",
    "publicKey": "MCowBQYDK2VwAyEA9ZAe7tQchbaF4v4FlLoiasoUBjBOX+UCBwZqBjlVZjs=",
    "registries": ["default", "ui", "shadcn", "egret-ui"]
  }
]
```

- `publicKey` is the base64 DER/SPKI encoding of an Ed25519 key. Every Ed25519
  SPKI key starts with `MCowBQYDK2VwAyEA`.
- `registries` scopes the key. A key is trusted only for the registries listed
  with it; a release from any other registry signed by the same key is
  rejected.

For each release it downloads, the build:

1. recomputes the SHA-256 of `signedManifest` and requires it to equal both
   `manifestHash` and `signature.manifestSha256`;
2. looks up `signature.keyId` among the keys trusted for that registry, and
   fails with `signed by untrusted key` if it is absent;
3. verifies the Ed25519 signature;
4. downloads the contract, the graph manifests and every module file, and
   checks each one against the SHA-256 and size recorded in the signed
   manifest.

Step 4 is what makes one signature cover everything: every byte vendored into
`bundles/` is bound by hash to the manifest that was signed.

### The lock records the signing key

Each verified entry in `.bundle-lock.json` records `releaseSignatureKeyId`. A
strict build reuses a lock entry only if that key ID is still trusted for the
registry. Removing a key from `trustedReleaseKeys` therefore forces every entry
it signed to be resolved and verified again. An entry with no
`releaseSignatureKeyId` — one written by a build that skipped verification — is
never reused by a strict build, and fails a `--frozen-lockfile` build.

## Development escape hatches

Two environment variables relax the build for local registry work:

| Variable | Effect |
| --- | --- |
| `HERON_ALLOW_INSECURE_REGISTRIES=1` | Allows `http://localhost` / `http://127.0.0.1` registry URLs. Every other registry must use HTTPS. |
| `HERON_ALLOW_UNSIGNED_COMPONENTS=1` | Skips signature verification and accepts unsigned releases from the local registry. |

Neither one disables the token: a local registry with a `consumers.json` still
requires `HERON_REGISTRY_TOKEN`. Neither one may be set in CI, staging or
production. A lock produced with `HERON_ALLOW_UNSIGNED_COMPONENTS=1` must be
refreshed by a strict build before it is committed. See
[Running Heron Locally](/docs/guides/running-locally).

## Why it is built this way

- **Build-time only.** The registry is a build dependency, like a package
  registry. Shipping a token to browsers or devices would make it public;
  shipping the signature check to them would add nothing, because the app
  bundle that ships is already the verified output.
- **Hash-only server state.** A leaked `consumers.json` does not leak any
  token, which is why it can be committed.
- **Public key pinned in the app, not fetched.** A key fetched from the
  registry would let whoever controls the registry also choose which key is
  trusted. Pinning it in the app's repository means a compromised registry
  host still cannot publish code the app accepts.
- **Signing separated from publishing.** Developers can publish freely; only
  the protected deployment workflow can make a release downloadable through
  v2.
