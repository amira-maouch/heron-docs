---
sidebar_position: 15
---

# How to Wire Heron to an Egret Backend

Widgets talk to your backend through one shared service: `egretClient`.

## 1. Initialize it once, in a middleware

```ts
// middlewares/services.ts
// @Middleware({ target:"page", stage:"route_matched", priority:100 })
const initServices = async (_context: any, next: any, _block: any) => {
  $egret.initService("egretClient", {
    apiBaseUrl: $egret.getEnv("EGRET_API_BASE_URL"),
  });
  await next();
};
```

`initService` is idempotent — safe to re-run on every navigation.
`EGRET_API_BASE_URL` (and friends like `EGRET_AUTH_BASE_URL`) come from your
`.env.local`, read via `$egret.getEnv(...)`.

## 2. Use it from any widget script

```ts
const client = $egret.getService("egretClient");

// List documents of a doctype
await client.listDocuments("contracting.contract", {
  filters: [["contracting.contract", "status", "=", "active"]],
  pageLength: 20,
});

// Get one document
await client.getDocument("contracting.contract", contractId);

// Run a command (write)
await client.runCommand(
  "contracting.contract.update_status",
  { status: "closed" },
  { aggregateId: contractId }, // required for instance commands
);

// Run a query (read)
await client.runQuery("reporting.summary", { from: "2026-01-01" });
```

Every call returns `{ ok: true, data }` or `{ ok: false, error }` — always
check `.ok` before touching `.data`.

## Instance commands need `aggregateId`

Commands that act on an existing record (`__update`, `__delete`, or a custom
one like `deactivate_user`) must pass the target id via `opts.aggregateId`, or
the request fails with `MISSING_AGGREGATE_ID`. Collection/creation commands
(`__add`) and module-scoped commands omit it.

## Pointing at a different host for one call

```ts
const authClient = client.withConfig({ apiBaseUrl: authBaseUrl });
```

Useful when auth lives on a split host (`EGRET_AUTH_BASE_URL`) separate from
your main API.

## Paginated tables

```ts
const { rows, meta } = (
  await client.documentQueryPaged("contracting.contract", { pageLength: 25, start: 0 })
).data;
// meta.total is an exact count over the same filters
```
