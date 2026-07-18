---
trigger: always_on
description: Mandatory development and deployment rules for the Klao Platform.
---

# Klao Platform Rules

## 1. Development Environment (Docker)
- **Mandatory Usage**: Local `docker-compose.yml` for testing.
- **Ports**: DB: `5433` (Ext) / `5432` (Int). Core: `3000`. Console: `5173`.
- **Warning**: Run `bun x prisma migrate dev` ONLY when `schema.prisma` is modified.
- **Warning**: Run `bun x prisma generate` immediately after migrations.

## 2. Monorepo Architecture
- **Rule (Shared-First)**: Logic/types used by BOTH `core` and `console` MUST be placed in `packages/shared`.
- **Dependency Management**: Use `bun` ONLY. Do not use `npm` or `yarn`. Keep `bun.lock` as the source of truth.
- **Absolute Imports**: Use path aliases (e.g., `@/components/`); no relative path spaghetti.

## 3. Code Quality & Reliability
- **Rule**: Wrap DB queries and external API calls in `try/catch` with standardized logging.
- **Rule**: Complex logic in `core/engine` MUST include rationale comments.
- **Git**: Never commit `node_modules`, build artifacts, or `.env`.

## 4. Plugin Architecture Standards
- **Rule (Lifted State)**: Plugin UI states (Drawers/Modals) MUST be lifted to `ConsoleContext` to survive platform re-mounts.
- **Warning (Hit-Box Safety)**: Header containers (`.klao-page-header__left`) MUST use `pointer-events: none` on container and `pointer-events: auto` on children.
- **Rule (Portaling)**: Use `React Portals` for ALL slide-over drawers to sit at document root.
- **Rule (Z-Index)**: Administrative overlays MUST use `z-index: 9999 !important`.

## 5. High-Performance Architecture (10k OPS)
- **Rule (Primary Keys)**: ALWAYS use CUID (`@default(cuid())`) or time-ordered string IDs for primary keys and foreign keys. NEVER use UUIDv4 (`@default(uuid())` or `@db.Uuid`) to avoid B-Tree fragmentation in PostgreSQL.
- **Rule (Dynamic Tables)**: All dynamically generated tables MUST use `VARCHAR(30)` or `TEXT` for IDs. NEVER use `gen_random_uuid()`. Use `generateTimeOrderedId()` from `QueryLayer.ts`.
- **Rule (Audit Logging)**: Audit logs MUST be dispatched asynchronously (fire-and-forget) OUTSIDE the main database transaction to prevent locking contention. NEVER perform synchronous inserts to `core.audit_logs` inside a CRUD transaction.
- **Rule (Database Indexes)**: ALL foreign key columns heavily queried (e.g., `tenantId`, `parentId`, `teamId`) MUST have explicit `@@index` annotations in `schema.prisma`.
- **Rule (Session Context)**: Always pass a pre-resolved `SessionContext` throughout `QueryLayer` methods to avoid redundant JWT decoding during multi-step transactions.