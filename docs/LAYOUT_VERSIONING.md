# Layout Versioning

Versioned layout definitions with rollback — additive only, **zero impact on records**.

## Model

```
core.table_layouts                    core.layout_versions
  id                                    id
  tableId                               layoutId   (FK, onDelete: Cascade)
  name / systemName                     version    (1, 2, 3…, unique per layout)
  status  draft | active                config     (frozen snapshot)
  config          (draft)               notes
  publishedConfig (published)           publishedBy / publishedAt
  currentVersion
```

- Every **Activate** publishes `config` → `publishedConfig` and inserts an
  immutable `LayoutVersion` snapshot (version = `currentVersion`, then
  `currentVersion += 1`).
- **`onDelete: Cascade`** — layouts have no pinned instances (unlike
  workflows), so deleting a layout removes its history. Records never
  reference a layout version; they render the live row's `publishedConfig`.

## Lifecycle (PATCH `/api/console/layouts`)

| Action | Behavior |
|---|---|
| `activate` (+ optional `notes`) | Transaction: publish config, bump `currentVersion`, insert `LayoutVersion` snapshot. Next version = `max(currentVersion, max existing version + 1)` — self-healing against backfilled snapshots |
| `rollback` + `targetVersion` | Copy that version's `config` → `config`, status → `draft` (re-activate to publish) |
| `start-edit` / `discard-draft` / DELETE / regular PATCH | Unchanged |

`GET /api/console/layouts?id=` now includes `versions` (desc).

## Why records are unaffected

All consumers (`ListViewEngine`, `DynamicDetailPage`, `LayoutStudio`, core
related route) read `layout.status === 'active' ? layout.publishedConfig :
layout.config` from the **live row**. Versioning adds a history table and a
counter column — the published config used for rendering is byte-identical.
No tenant-schema changes, no RLS changes, no consumer code changes.

## Migration (first deploy)

Run `scripts/migrate-layout-versions.sql` once per environment: every
existing layout gets a v1 snapshot (active → `publishedConfig`, draft →
`config`) — "all deployed layouts become version 1". Never run from a GET
handler.

## Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `TableLayout.currentVersion`, `LayoutVersion` model |
| `src/app/api/console/layouts/route.ts` | Activate transaction, rollback, GET versions |
| `src/pages/custom/LayoutStudio.tsx` | Version History panel, Rollback, notes on Activate, version badge |
| `scripts/migrate-layout-versions.sql` | One-off v1 backfill |
