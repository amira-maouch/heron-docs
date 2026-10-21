---
sidebar_position: 7
title: Server hardening (version TBD)
---

# Migrate a consumer app to the server-hardening release

:::info Release version

This guide covers the Heron changes developed on the `server-hardening`
branch. Replace **`HERON_VERSION_TBD`** with the published Heron version before
using this guide for a production upgrade.

:::

Use Heron's Claude Code migration skill to inspect and migrate each consumer
application. The skill understands the security changes as a group, checks
which ones apply to the app, makes the app-side changes, rebuilds generated
artifacts, and runs the relevant verification.

The skill is intentionally conservative: it preserves unrelated work, does not
invent deployment settings, and does not commit, publish, deploy, or rotate
real credentials unless you explicitly ask it to.

## Install the migration skill

The skill is maintained in the Heron repository at:

[`heron/.claude/skills/migrate-heron-server-hardening`](https://github.com/white-stork/heron/tree/main/.claude/skills/migrate-heron-server-hardening)

Copy the whole directory into the consumer application's project-level Claude
Code skills directory:

```bash
mkdir -p .claude/skills
cp -R /path/to/heron/.claude/skills/migrate-heron-server-hardening \
  .claude/skills/
```

The copied directory must include all three parts:

```text
.claude/skills/migrate-heron-server-hardening/
├── SKILL.md
├── references/
│   └── migration-checklist.md
└── scripts/
    └── audit-consumer.sh
```

Project-level installation is recommended so the app team uses the same
checklist and can review changes to it like any other project file.

## Run it

Open Claude Code from the consumer application and invoke:

```text
/migrate-heron-server-hardening .
```

You can also give it another consumer path:

```text
/migrate-heron-server-hardening ../another-consumer-app
```

For multiple apps, run the skill separately in each repository. This keeps
each app's diff, backend-specific authentication behavior, and test results
independent.

## What the skill migrates

The skill first audits the app and marks every area as **required**,
**already compliant**, **not applicable**, or **needs owner input**. It then
implements and verifies the applicable work.

### Consumer migration checklist

- [ ] Record the installed Heron packages and how the app will consume
      `HERON_VERSION_TBD`.
- [ ] Preserve existing working-tree changes and follow the app's repository
      instructions.
- [ ] Remove metadata-supplied executable JavaScript using `functionBody` or
      `functionParams` and replace it with registered action identifiers.
- [ ] Preserve normal component callbacks and locally handled events whose
      payload type is `"custom"`; these are not executable metadata actions.
- [ ] If the app stores browser credentials, migrate it to the middle auth
      model: an HttpOnly session/refresh credential and a short-lived access
      token held only in browser memory.
- [ ] Keep ordinary business API requests going directly from the browser to
      the app backend; do not add a general backend proxy.
- [ ] Implement the app-specific `AuthAdapter` lifecycle needed for login,
      verification, session resume/refresh, and logout.
- [ ] Change API, polling, and realtime clients to obtain access tokens from
      `await $heron.auth.getAccessToken()`.
- [ ] Clear the in-memory token and retry at most once after an authenticated
      backend `401`; never create an infinite refresh loop.
- [ ] Remove legacy access-token, refresh-token, and token-expiry keys from
      browser storage while preserving non-secret user preferences where
      appropriate.
- [ ] Confirm protected widget, raw-widget, and script requests reject missing
      or forbidden credentials correctly.
- [ ] Confirm server widget loaders receive only credentials accepted by the
      configured adapter's `verify()` method.
- [ ] Check client code for unsafe HTML sinks and migrate user/API-controlled
      values to safe DOM or Heron HTML helpers.
- [ ] Verify hardened response headers, public-env secret checks, sanitized
      server errors, locale validation, and the absence of production source
      maps.
- [ ] Rebuild vendored components/services, browser output, SSR/server output,
      widget output, and OTA bundles that consume the upgraded packages.
- [ ] Re-sign rebuilt OTA bundles and confirm they contain only runtime assets
      when the app ships OTA updates.
- [ ] Run focused authentication/security tests followed by the app's normal
      lint, typecheck, test, browser, server/SSR, and production builds.
- [ ] Review the final diff and report remaining deployment decisions and
      known baseline failures separately.

## Authentication model used by the migration

For browser apps that call their backend directly, the migration uses this
split:

```text
HttpOnly cookie
  └── long-lived refresh/session credential
      └── unavailable to browser JavaScript

Browser memory
  └── short-lived access token
      └── obtained through $heron.auth.getAccessToken()

Business requests
  └── browser → app backend directly
```

Heron's same-origin `/api/auth/*` endpoints handle only session login,
validation, access-token restoration, and logout. They are not a proxy for the
app's business APIs.

After login, the app seeds the newly issued short-lived token with
`$heron.auth.setAccessToken(...)`. On reload, Heron restores a usable access
token from the HttpOnly session. The app's adapter decides whether an existing
token can be reused or must be refreshed; a page refresh does not inherently
mean issuing a new JWT.

See [Authentication and Authorization](/docs/guides/backend-and-auth/authentication-and-authorization)
for the wider adapter and route-authorization model.

## Important scope boundaries

### This does not automatically enable default-deny

Secure token storage and route authorization are separate concerns. Enabling
Heron authorization does not make undeclared routes private: missing `auth`
and `can` declarations are still public.

If an app needs default-deny, treat it as a separate app-specific change:

1. Protect the manifest by default.
2. Mark only genuine login, recovery, landing, and other public routes with
   `auth: false`.
3. Add `can` declarations for administrative and tenant-sensitive routes.
4. Test anonymous, authenticated-but-forbidden, and authorized users.
5. Keep backend authorization as the real business-data security boundary.

The skill reports whether default-deny is present, but does not invent an
app's permission model.

### Registry-token work is separate

Private registry download tokens (#199) and signed registry releases (#1000)
were developed on separate `registry-token` branches. They are not silently
applied by this `server-hardening` migration. Plan that rollout separately if
the consumer also needs it — see
[5.0.0 → 5.1.4](/docs/migration/5.0.0-to-5.1.4) and
[Connect a New App to the Registry](/docs/guides/setup/connect-a-new-app-to-the-registry).

### Deployment settings need deployment facts

The skill does not guess:

- allowed CORS origins;
- trusted proxy addresses or hop counts;
- distributed rate-limit storage;
- cookie domains;
- the final strict Content Security Policy; or
- application permission names.

It records missing decisions for the application or infrastructure owner.

## Verification before release

Do not approve the consumer upgrade until:

- login, refresh/reload, authenticated requests, one-time `401` recovery, and
  logout work against the real backend contract;
- no access or refresh credential remains in `localStorage` or
  `sessionStorage`;
- normal `"custom"` component events still work;
- protected widget and script endpoints return `401`/`403` as expected;
- production builds contain no source maps or secret-bearing public env names;
- generated and vendored artifacts actually contain the upgraded Heron code;
- all applicable consumer tests and production builds pass; and
- the handoff explicitly says whether default-deny was implemented.

The source migration does not revoke credentials already issued to users.
After deploying the browser-storage migration, follow the backend's normal
session-revocation plan if old refresh tokens must be invalidated.

## Rollback

Before deployment, keep the previous dependency lockfile and generated
artifacts available through the app's normal version control and release
process. To roll back, restore the previous Heron package versions, reinstall,
and rebuild every generated/vendor/OTA artifact from those versions.

Do not roll back only `package.json` while leaving bundles or server output
built from the hardened release; mixed framework artifacts can produce auth or
runtime behavior that does not match either version.
