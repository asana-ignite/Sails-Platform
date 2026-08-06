# Workflow Definition Versioning

Versioned approval-workflow definitions with instance pinning.

## Model

Two core-schema tables:

```
core.workflow_definitions        core.workflow_versions
  id                               id
  tenantId                         defId        (FK, onDelete: Restrict)
  name                             version      (1, 2, 3…, unique per def)
  systemName   (unique)            config       (frozen DAG snapshot)
  tableId                          notes
  status  draft | active | deactivated
  currentVersion                   publishedBy
  config          (draft DAG)      publishedAt
  publishedConfig (published DAG)
  isDefault / isSystem
  deactivatedAt / deactivatedBy
```

- `config` = the DAG currently being edited (draft).
- `publishedConfig` = the DAG currently published (active).
- Every **Activate** inserts a new immutable `WorkflowVersion` row — the
  version history. Versions are never updated or deleted (`onDelete: Restrict`).

## Lifecycle (PATCH `/api/workflows`)

| Action | Behavior |
|---|---|
| `activate` (+ optional `notes`) | Publishes `config` → `publishedConfig`, inserts a `WorkflowVersion` snapshot, bumps `currentVersion`, status → `active` |
| `start-edit` | Copies `publishedConfig` → `config`, status → `draft` |
| `discard-draft` | Copies `publishedConfig` → `config`, status → `active` (revert to published) |
| `rollback` + `targetVersion` | Copies that version's `config` → `config`, status → `draft` (edit, then re-activate to publish) |
| `deactivate` | Soft delete — `status='deactivated'`. Running instances keep running on their pinned version. No new instances can start. |
| `DELETE` | **Blocked (409)** while any running instance references a version of this definition. Use `deactivate` instead. |

## Instance pinning

`wf_instance.version_id` (tenant schema) is frozen at instance start to the
definition's **newest published `WorkflowVersion`**. The engine reads the DAG
exclusively from that snapshot (`WorkflowEngine.advanceInstance`) — the live
draft and future activations never affect in-flight instances.

- Activate v4 while v3 instances run → v3 instances continue on v3; new
  instances start on v4.
- Deactivate → old instances continue; new starts rejected.

## Migration (first deploy)

Run `scripts/migrate-workflow-versions.sql` once per environment to backfill
v1 snapshots for pre-versioning definitions. Never run from a GET handler.

Future instance migration (moving running instances to a newer version) is a
deliberate, explicit migration tool — see roadmap; it is not automatic.

## Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `WorkflowDefinition`, `WorkflowVersion` models |
| `src/app/api/workflows/route.ts` | CRUD + lifecycle actions |
| `src/core/engine/WorkflowEngine.ts` | `startInstance` (version pinning), `advanceInstance`, `countInstancesForDefinition` |
| `scripts/migrate-workflow-versions.sql` | One-off backfill |
