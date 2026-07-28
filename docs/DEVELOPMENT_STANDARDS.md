# SAILS Development Standards & Architecture

This document serves as the single source of truth for system-wide architectural rules, security pipelines, and implementation standards for the SAILS platform.

## 1. Database Architecture & Security

### Schema Segregation Rule
- **Rule:** Strict logical boundary between system metadata and user data.
- **`core` Schema:** Metadata & Engine. Prisma-managed. NO direct read/write access for staff.
- **`tenant_{schemaName}` Schema:** Dynamic Data. One per business unit.

### Table Lifecycle & Metadata Models
- **Creation:** `TranslatorLayer.ts` writes to `core.tables`. `AlchemaCore.ts` executes `CREATE TABLE tenant_X...`.
- **Mandatory Columns:** `id` (CUID/String), `created_at`, `updated_at`, `owner_id`, `created_by`, `updated_by`.
- **Metadata Constraint:** Dynamic schema metadata tables (`core.tables` and `core.fields`) MUST include an `is_system` boolean column to prevent runtime 500 errors.

### Security & Row-Level Security (RLS)
- **Rule:** Database enforces RLS natively on dynamic tables.
- **Execution:** `TransactionContext` injects user/tenant ID via `SET LOCAL` during query execution.
- **Warning:** `AlchemaCore` MUST bind the `projects_owner_policy` (or equivalent) upon table creation.

### Asynchronous Audit Logging
- **Rule:** ALL DML operations must be wrapped by `QueryLayer.ts`.
- **Requirement (10k OPS):** Mutations MUST write to `core.audit_logs` *asynchronously*, outside of the main exact transaction, to prevent holding row locks and inflating write contention.

### Testing
- **Test Override:** `session.ts` supports `TEST_SESSION_JSON` for CLI/Docker integration testing without browser context.

---

## 2. API & Security Pipeline

### The Mandatory Security Pipeline (Order is STRICT)
1. **Authentication (`getAppSession`)**: Resolves identity and context.
2. **RBAC (`AccessGuard`)**: Enforces object-level capabilities.
3. **RLS (`TransactionContext`)**: Injects context into PostgreSQL.
4. **DML & Audit (`QueryLayer`)**: Ensures atomic data mutation and logging.
5. **Verification (`test-security.ts`)**: Validates pipeline integrity.
- **Warning:** Failure at any stage MUST result in immediate HTTP error.

### Provisioning Rules
- **Endpoint:** `POST /api/tenant/provision`
- **Rule:** `name` is always required. Exactly one of `adminEmail` or `existingUserId` must be provided.
- **Deduplication:** Auto-appends `_1`, `_2` to schema names on conflict.

### Module (App) Configuration
- **Endpoint:** `GET /api/console/config`
- **Rule:** `POST /api/console/apps` requires `TENANT_ADMIN` or `SUPER_ADMIN`.

### Dynamic Data CRUD
- **Rule:** Accessing `[tableName]` MUST respect the Security Pipeline.
- **Warning:** `DELETE /api/dynamic/[tableName]/[id]` captures `old_values` in `core.audit_logs` atomically.

### Roles
- **`SUPER_ADMIN`:** `AccessGuard` fast-path — bypasses DB lookup.
- **`TENANT_ADMIN`:** Full CRUD within business unit; subject to `object_permissions`.
- **`MEMBER`:** Subject to `object_permissions` and RLS ownership.

---

## 3. UI & Navigation System

### Architecture
- **Mobile Triple-Dock**: App Switcher (Left), Main Nav (Middle), Notifications/Profile (Right).
- **Desktop Sidebar**: Accordion mode (Expanded) or Flyout mode (Collapsed).

### "Ghost Glass" Design System Rules
- **Rule:** Backdrop Blur is `24px` for main panels, `20px` for overlays.
- **Rule:** Panel Backgrounds must be `rgba(255, 255, 255, 0.12)` (Light) or `rgba(0, 0, 0, 0.2)` (Dark).
- **Rule:** Borders must be `1px solid rgba(255, 255, 255, 0.2)` to define edges.
- **Rule:** Border radius: `24px` (Panels), `16px` (Cards), `12px` (Sub-menu items).

### Interactions & Layout
- **The Squeeze:** Active states use `transform: scale(0.9) translateY(2px)`.
- **Smart Dismissal:** Click-away closes panels. Only one mobile panel open at a time.
- **Page Container:** `.sails-page-container` has `max-width: 1400px`.
- **Warning (Hit-Box Safety):** Header action hit-boxes MUST use `pointer-events: none` on container and `pointer-events: auto` on children to prevent invisible click-blocking.
- **Rule (Portaling):** Overlays and slide-over drawers MUST use React Portals to ensure they sit at the document root.

### Navigation Sync Standard
- **Visibility:** Creating a new dynamic table in the database is NOT enough to make it appear in the SAILS Console. 
- **Rule:** You MUST create a corresponding entry in `core.console_menus` and map it to a valid `core.console_apps` record for UI rendering.

### Module-First Shell
- **`AppPluginShell`**: Wraps custom modules. Resolves context, metadata, injects plugin, and harmonizes layout.

---

## 4. Future Constraint: PWA Offline-First Architecture (DO NOT IMPLEMENT YET)

> **Strategic Vision:** Enable offline functionality for field operations via Service Workers and IndexedDB.

The following constraints are **pre-declared** to prevent architectural decisions today that would conflict with offline sync in the future.

| Constraint | Rule |
|---|---|
| **Primary Keys** | The database MUST NOT be the sole ID generator. Client-generated UUIDv4 IDs (via `crypto.randomUUID()`) MUST be accepted on all endpoints and used *before* any save action. |
| **Local Storage (IndexedDB)** | The Console must use **Dexie.js** as the in-browser database for caching schemas and records. |
| **`updatedAt` Field** | Must be **writable by the client** during sync. The API must allow the client to supply `updatedAt` when flushing the SyncQueue. |
| **Conflict Resolution** | Server (`AlchemaCore`) will implement **Last Write Wins (LWW)**: `clientUpdatedAt > serverUpdatedAt` → apply; otherwise → reject and return current server state. |
| **SyncQueue Protocol** | Offline mutations are queued client-side and pushed sequentially via the Background Sync API. Idempotent `CREATE` operations must be supported (inserting a record whose UUID already exists must be a no-op). |
