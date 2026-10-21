---
sidebar_position: 5
---

# How to Manage Registry Consumers and Signing Keys

This guide is for **registry administrators** — whoever maintains
`heron_registry` and its deployment. App teams only need
[Connect a New App to the Registry](/docs/guides/setup/connect-a-new-app-to-the-registry).

It covers issuing, rotating and revoking consumer tokens, and the custody and
rotation of the release signing key. For the model behind both, see
[Registry Tokens and Release Signing](/docs/explanation/registry-tokens-and-release-signing).

All commands run from the `heron_registry` repository root.

## Where things live

| Item | Location |
| --- | --- |
| Consumer records (token hashes + scopes) | `apps/registry/consumers.json`, committed. The server loads it automatically. Format example: `apps/registry/consumers.example.json` |
| Release store | `apps/registry/releases/` — manifests, `*.signature.json` sidecars, blobs |
| Signing private key | Repository secret `HERON_RELEASE_SIGNING_PRIVATE_KEY` (PEM or base64 PKCS#8) |
| Signing key ID | Repository variable `HERON_RELEASE_SIGNING_KEY_ID` (currently `registry-release-2026`) |
| Signing step | `.github/workflows/registry-cicd.yaml` → **Sign component releases for deployment**, on every push to `main` |
| Public key for consumers | Artifact `registry-public-trust-<commit>` of each successful run (kept 90 days) |

Instead of the committed file, the server also accepts `REGISTRY_CONSUMERS_FILE`
(a path; re-read when it changes) or `REGISTRY_CONSUMERS_JSON` (inline). Set at
most one. With `NODE_ENV=production` — or `REGISTRY_AUTH_REQUIRED=1` — the
server refuses to start without a valid consumer configuration.

## Consumer tokens

### Issue a token for a new app

1. Generate the token and its record:

   ```bash
   pnpm --filter component-registry token:create -- \
     --consumer myapp-web-ci \
     --registries default,ui,shadcn,egret-ui
     # optional: --expires 2027-10-21T00:00:00Z
   ```

   - `--consumer`: lowercase letters, digits and hyphens. It becomes part of
     the token, so it cannot be renamed later.
   - `--registries`: grant only what the app uses. A web app and a native
     content server should be separate consumers with separate scopes.

2. The command prints the plaintext token **once**, then a hash-only record.
   Hand the token to the app team over a private channel, or set it as their
   CI secret yourself:

   ```bash
   gh secret set HERON_REGISTRY_TOKEN -R <org>/<myapp-repo>
   ```

   Do not save the token anywhere else. If it is lost, issue a new one.

3. Append the record to the `consumers` array in
   `apps/registry/consumers.json`. The record contains no secret. The command
   validates it with the server's own parser, so a record it prints never
   stops the registry from starting.

4. Commit and merge to `main`. The registry deployment ships the new file; the
   token returns `401` until it is deployed.

5. Check it:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "X-Registry-Token: <token>" \
     https://registry.heron.ws/api/v2/registries/ui/components/bundle
   ```

   `200` means it works; `403` means a registry is missing from the scope.

### Change a consumer's scope

Edit the consumer's `registries` array and deploy. The token does not change.

To share a registry with every authenticated consumer, add it to the
top-level `publicRegistries` array (or the `REGISTRY_PUBLIC` environment
variable). Shared registries are never readable without a token.

### Rotate a token

Rotation keeps the old token working while the app switches:

1. Generate a replacement **under the same consumer ID**:

   ```bash
   pnpm --filter component-registry token:create -- \
     --consumer myapp-web-ci --registries default,ui,shadcn,egret-ui
   ```

2. From the printed record, copy only the new entry of `hashes` and **append**
   it to the existing consumer's `hashes` array. Do not add a second consumer
   record with the same ID — the server rejects duplicate IDs.
3. Deploy, then update the app's `HERON_REGISTRY_TOKEN` secret and local
   `.env.local` files.
4. Once the app has built successfully with the new token, remove the old
   hash, or set its `notAfter` to a past date, and deploy again.

:::caution[Never rename a consumer or overwrite its hash in place]

The consumer ID is embedded in the token, and the hash is the only thing the
server checks it against. Renaming the record, or replacing a hash without the
overlap above, instantly turns the app's CI secret into a `401`. To tell which
record a token belongs to, compare its hash with the file:

```bash
printf %s "$HERON_REGISTRY_TOKEN" | shasum -a 256
```

:::

### Expire or revoke

| Goal | Change in `consumers.json` |
| --- | --- |
| Retire one token of a consumer | Set that hash's `notAfter` to an ISO date, or remove the hash |
| Expire the whole consumer on a date | Set `expiresAt` |
| Revoke the consumer now | Set `disabled: true` |

Each takes effect when the change is deployed. A leaked token should be
revoked at once — remove its hash and deploy — and the app given a new one.

## The release signing key

### How releases get signed

Developers publish unsigned release candidates:

```bash
pnpm publish:components
pnpm publish:component -- shadcn/shadcn/accordion
```

On each push to `main`, the deployment workflow runs
`pnpm --filter component-registry sign:existing-releases` with the signing
secret. It verifies every stored release, writes a signature sidecar for each
release that lacks one, publishes and signs the current aggregate snapshots,
and exports the public key. The registry image is built from that signed
release store; the private key is not copied into it.

Sidecars written in CI are not committed back to the repository. A local
registry on `:4100` therefore serves only the sidecars that are committed, and
answers `503` for newer releases until someone signs and commits them (or the
developer builds with `HERON_ALLOW_UNSIGNED_COMPONENTS=1`).

An operator holding the key can also publish and sign in one step:

```bash
export HERON_RELEASE_SIGNING_KEY_ID=registry-release-2026
export HERON_RELEASE_SIGNING_PRIVATE_KEY_FILE=/secure/path/release-private.pem
pnpm publish-and-sign:components
```

### Custody

The private key exists only as the `HERON_RELEASE_SIGNING_PRIVATE_KEY`
repository secret unless the operator who generated it kept a copy.
GitHub secrets cannot be read back. Keep one offline backup — for example in
the team's password manager — readable only by registry administrators. The
key must never be committed, copied into the registry image, sent to app
teams, or reused as a registry token.

If the key is lost without a backup, published releases keep working —
their sidecars already exist — but new releases cannot be signed until the key
is rotated.

### Rotate the signing key

Rotation adds a new key; it does not invalidate the old one. Existing releases
keep their original signatures, and new releases are signed by the new key.

1. Generate a key pair in a protected environment:

   ```bash
   umask 077
   openssl genpkey -algorithm ED25519 -out release-private.pem
   openssl pkey -in release-private.pem -pubout -outform DER | openssl base64 -A
   ```

   The last command prints the public key in the format `trustedReleaseKeys`
   expects.

2. Choose a new key ID, for example `registry-release-2027`. Key IDs use
   letters, digits, `.`, `_` and `-`, up to 128 characters.

3. **First**, add the new key to every consumer app's `trustedReleaseKeys`,
   next to the existing one:

   ```json
   "trustedReleaseKeys": [
     {
       "keyId": "registry-release-2026",
       "publicKey": "MCowBQYDK2VwAyEA9ZAe7tQchbaF4v4FlLoiasoUBjBOX+UCBwZqBjlVZjs=",
       "registries": ["default", "ui", "shadcn", "egret-ui"]
     },
     {
       "keyId": "registry-release-2027",
       "publicKey": "<new base64 SPKI key>",
       "registries": ["default", "ui", "shadcn", "egret-ui"]
     }
   ]
   ```

   Apps that do not yet trust the new key fail with
   `signed by untrusted key "registry-release-2027"` as soon as they resolve a
   release signed with it.

4. **Then** update the repository secret and variable, and back up the new
   private key:

   ```bash
   gh secret set HERON_RELEASE_SIGNING_PRIVATE_KEY -R white-stork/heron_registry < release-private.pem
   gh variable set HERON_RELEASE_SIGNING_KEY_ID -R white-stork/heron_registry --body registry-release-2027
   ```

5. Merge a change to `main`, and confirm the run's
   `registry-public-trust-<commit>` artifact reports the new key ID and public
   key.

6. Delete the local `release-private.pem` once it is in the secret and the
   backup.

Apps must keep the old key for as long as they use releases it signed.

### If the signing key is compromised

A leaked key can sign manifests that every consumer accepts. Treat it as an
incident:

1. Rotate to a new key, steps 1–5 above.
2. Remove the compromised key from every app's `trustedReleaseKeys`. Their
   next build refuses every lock entry it signed and resolves those
   components again.
3. Releases signed only by the compromised key now fail verification. Remove
   their committed `*.signature.json` sidecars from `apps/registry/releases/`
   and deploy: the workflow signs those releases again with the new key. This
   is the one case where sidecars, otherwise immutable, are replaced.
4. Rebuild and redeploy every consumer app.

## Related

- [Sign Native OTA Bundles](/docs/guides/setup/sign-native-ota-bundles) — the
  separate, per-app key for React Native content bundles.
