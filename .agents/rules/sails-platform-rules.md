---
trigger: always_on
description: Mandatory development and deployment rules for the Sails Platform.
---

# Sails Platform Rules

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
- **Warning (Hit-Box Safety)**: Header containers (`.sails-page-header__left`) MUST use `pointer-events: none` on container and `pointer-events: auto` on children.
- **Rule (Portaling)**: Use `React Portals` for ALL slide-over drawers to sit at document root.
- **Rule (Z-Index)**: Administrative overlays MUST use `z-index: 9999 !important`.

## 5. High-Performance Architecture (10k OPS)
- **Rule (Primary Keys)**: ALWAYS use CUID (`@default(cuid())`) or time-ordered string IDs for primary keys and foreign keys. NEVER use UUIDv4 (`@default(uuid())` or `@db.Uuid`) to avoid B-Tree fragmentation in PostgreSQL.
- **Rule (Dynamic Tables)**: All dynamically generated tables MUST use `VARCHAR(30)` or `TEXT` for IDs. NEVER use `gen_random_uuid()`. Use `generateTimeOrderedId()` from `QueryLayer.ts`.
- **Rule (Audit Logging)**: Audit logs MUST be dispatched asynchronously (fire-and-forget) OUTSIDE the main database transaction to prevent locking contention. NEVER perform synchronous inserts to `core.audit_logs` inside a CRUD transaction.
- **Rule (Database Indexes)**: ALL foreign key columns heavily queried (e.g., `tenantId`, `parentId`, `teamId`) MUST have explicit `@@index` annotations in `schema.prisma`.
- **Rule (Session Context)**: Always pass a pre-resolved `SessionContext` throughout `QueryLayer` methods to avoid redundant JWT decoding during multi-step transactions.
- **Rule (Network Latency & RLS)**: When injecting RLS session context via `set_config`, you MUST bundle all variables into a single chained SQL query (`SELECT set_config(...), set_config(...)`) to eliminate redundant network round-trips. Do the same for `RESET`.
- **Rule (Connection Pooling)**: Database instantiations (Prisma or `pg`) MUST enforce PgBouncer context (`pgbouncer=true` and `connection_limit`) in production environments to prevent `max_connections` exhaustion at 10,000 OPS.

## 6. Zoning & Multi-Database Readiness
- **Rule (Cell-Based Isolation)**: Design all platform features assuming single-instance deployment operates as **Zone 01**, with capability to scale into multiple isolated database zones (`Zone 01...N`).
- **Rule (Stateless Core API)**: Core API containers MUST remain stateless, deriving identity from JWT claims or environment variables (`ZONE_ID`). Never introduce stateful in-memory node singletons that assume a single global database.
- **Rule (Per-Tenant Sequence Isolation)**: Autonumber counters and sequence fields MUST be scoped strictly to `tenant_id` or tenant schema. Never create shared global PostgreSQL sequence generators across tenants.
- **Rule (Global ID Integrity)**: All primary keys MUST use globally unique CUIDs/time-ordered IDs (`generateTimeOrderedId()`) so record relocation between Zone databases never produces ID collisions.

## 7. Layout Engine & Dynamic Table Standards
- **Rule (Layout Alignment)**: Dynamic table pages MUST map list properties (`config.columns`, `config.filters`, `config.sortBy`, `allowMultiSelect`, `allowPaging`, `recordsPerPage`) to real database query data using the Layout Studio runtime component structure (`.ls-table-card`, `.ls-runtime-table`, `.ls-rth`, `.ls-rtd`, `.ls-pagination`).
- **Rule (System Field Exclusion)**: Default fallback column generation for unconfigured tables MUST automatically exclude internal platform system/audit fields (`is_active`, `is_system`, `tenant_id`, `owner_id`) from table views.
- **Rule (Layout Activation Sync)**: Activating or publishing a layout (`action === 'activate'`) MUST atomically update both `config` and `publishedConfig` in database records to ensure instant runtime layout propagation.
- **Rule (Tenant Admin Bypass)**: AccessGuard object permission checks MUST include fast-path permission approval for both `SUPER_ADMIN` and `TENANT_ADMIN` roles across dynamic tenant objects.
- **Rule (Dropdown & Popover Overflow)**: Dropdown controls inside bottom containers (such as pagination footers) MUST specify upward dropup direction (`direction="up"`) or boundary detection, and parent containers (`.ls-table-card`, `.ls-pagination`) MUST enforce `overflow: visible` to prevent popover clipping.