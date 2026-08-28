---
sidebar_position: 1
title: Migration Guide Template
---

# Migration Guide Template

Use this as the starting point for each new migration guide. Copy this file
to a new one named for the versions involved, e.g. `v1-to-v2.md`, and fill in
the sections below. Delete this note once you have real guides in place.

## Before you start

- Who/what this migration affects (which packages, apps, or consumers).
- Estimated effort / risk level.
- Any prerequisite migrations that must happen first.

## Breaking changes

List each breaking change with:
- What changed and why.
- The error or symptom you'll see if you don't migrate.
- The affected package(s) — link to [App Structure](/docs/heron/app-structure)
  entries where relevant.

## Step-by-step

1. ...
2. ...
3. ...

## Verifying the migration

How to confirm the migration succeeded (commands to run, checks to make).

## Rollback

How to revert if something goes wrong mid-migration.

---

:::tip Adding the next migration guide
Add a new file in this folder (e.g. `docs/migration/v1-to-v2.md`) with an
increasing `sidebar_position`, following this template. It will appear here
automatically — no config changes needed.
:::
