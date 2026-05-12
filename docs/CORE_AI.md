# INIDOS Core — Internal Operating System Engine

## Product Identity
- **Product Name**: INIDOS (pronounced "ไอ-นิ-ดอส")
- **Full Name**: Ignite Idea Operating System
- **Domain**: Internal usage at Ignite Idea
- **Backend Packages**: **INIDOS Core** (this repository — `/packages/core`)
- **Frontend Packages**: **INIDOS Console** (this repository — `/packages/console`, developed as a PWA and ready for offline usage)

## Project Overview
INIDOS Core is a high-performance, multi-tenant internal operating system engine built with Bun, TypeScript, and PostgreSQL. It operates as a completely **Headless Backend API** — no UI code exists in this project. The frontend (INIDOS Console) is fully decoupled. The system enables Ignite Idea to define custom data structures (Sales Leads, Project Tasks, Cases, Timesheets) which are dynamically translated into native PostgreSQL tables in real-time.

## Project Documentation
| File | Purpose |
|---|---|
| **[AI.md](AI.md)** | Main architectural overview and system entry point for developers/AI. |
| **[BACKLOG.md](BACKLOG.md)** | Tactical To-Do list. Contains specific tasks, bugs, and feature progress. |
| **[ROADMAP.md](ROADMAP.md)** | Strategic high-level vision. Outlines the long-term security and isolation phases. |
| **[DATABASE.md](DATABASE.md)** | Deep dive into the schema-per-tenant isolation and DDL/DML strategies. |
| **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** | Detailed REST API reference for metadata and dynamic data endpoints. |

## Terminology
| INIDOS Term | What It Means |
|---|---|
| **Table** | A dynamic data structure defined by the platform (e.g., "Projects"). Prisma model: `TableDefinition`. |
| **Field** | A column within a Table (e.g., "Deadline"). Prisma model: `FieldDefinition`. |
| **Tenant** | A department or subsidiary within Ignite Idea. Owns a dedicated PostgreSQL schema. |
| **Console App** | A high-level application entry for the App Switcher (e.g., Sales, Timesheets). Prisma model: `ConsoleApp`. |
| **Console Menu** | A navigation item in the Sidebar, potentially nested. Prisma model: `ConsoleMenu`. |

## API Endpoints (INIDOS Core)
The following key endpoints provide the UI configuration and dynamic data necessary for the **INIDOS Console** frontend.

### UI Metadata
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/console/config` | Fetches the hierarchical Apps and Menus for the authenticated user. **Development Fallback**: Uses `DEFAULT_TENANT_ID` env-var if no session is present. |

### Metadata Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/metadata/objects` | Lists all defined Tables for the system. |
| `POST` | `/api/metadata/objects` | Creates a new Table definition. |
| `GET` | `/api/metadata/[tableName]` | Fetches full schema (Fields + Rules) for a table. |
| `POST/PATCH/DELETE` | `/api/console/apps` | Full CRUD for Console Apps. |
| `POST/PATCH/DELETE` | `/api/console/menus` | Full CRUD for Navigation Menu items. |
| `GET` | `/api/console/permissions` | Fetches the full `SystemPermissionRegistry` (Labels/Desc). |
| `POST/DELETE` | `/api/console/permissions` | Assigns/Revokes system capabilities for a specific Team. |


### Dynamic Data
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dynamic/[tableName]` | Fetches records from a dynamic table (enforces RLS). |
| `POST` | `/api/dynamic/[tableName]` | Inserts a new record (atomic audit logging). |

## Technology Stack
- **Runtime**: Bun (native TypeScript execution + binary compilation for IP protection)
- **Framework**: Next.js (API routes only — no UI)
- **Database**: PostgreSQL
- **ORM**: Prisma (for `core` Metadata schema)
- **Query Builder**: `pg` + `pg-format` (for Dynamic DDL/DML)
- **Validation**: Zod (Dynamic generation from metadata via FieldRegistry plugins)

## Detailed Folder Structure
/Users/asana/Repo/INIDOS/packages/core
├── prisma/                  ← Metadata Definition
│   ├── schema.prisma        ← The "Schema of Schemas" — all models in @@schema("core")
│   └── migrations/          ← Applied migrations (auth_schema_core)
│
│
├── scripts/             ← Utility & Maintenance Scripts
│   ├── clean-db.ts      ← Full DB wipe tool
│   ├── reset-platform.ts← Phased API reset tool
│   └── seed.ts          ← Basic tenant seeder
│
├── tests/               ← Integration Test Suite
│   ├── test-engine.ts   ← AlchemaCore DDL tests
│   ├── test-security.ts ← RBAC/RLS security scenarios
│   └── ...              ← Other scenario tests
│
├── src/
│   ├── app/
│   │   └── api/             ← Public API Surface
│   │       ├── auth/        ← NextAuth identity provider endpoints
│   │       ├── users/       ← User session and context endpoints
│   │       ├── tenant/      ← Onboarding & Provisioning endpoints
│   │       ├── metadata/    ← Schema Definition (Tables/Fields) endpoints
│   │       └── dynamic/     ← Data CRUD endpoints (GET/POST/PATCH/DELETE)
│   │
│   ├── cli/                 ← Internal Admin Tooling
│   │   └── inidos-cli.ts    ← Script for provisioning, cleanup, and status checks
│   │
│   ├── core/
│   │   ├── engine/          ← The Heart of INIDOS
│   │   │   ├── AlchemaCore.ts       ← Raw DDL Generator (injection-proof via pg-format)
│   │   │   ├── ConnectionManager.ts ← Central DB resolver (handles isolation modes)
│   │   │   ├── QueryLayer.ts        ← Secure DML (Audit logs, RBAC, RLS — all atomic)
│   │   │   ├── AccessGuard.ts       ← Object-level RBAC; SUPER_ADMIN fast-path
│   │   │   └── TransactionContext.ts← Injects SET LOCAL RLS context per transaction
│   │   │
│   │   └── registry/        ← Modularity System
│   │       ├── FieldRegistry.ts    ← Manager for dynamic field type plugins
│   │       └── types/              ← Plugins for text, number, relation, etc.
│   │
│   ├── services/            ← Business Logic Orchestration
│   │   ├── TranslatorLayer.ts      ← Syncs Metadata BLUEPRINTS to Physical TABLES
│   │   └── TenantProvisioner.ts    ← Atomic customer onboarding logic
│   │
│   ├── lib/                 ← Core Utilities
│   │   ├── security/        ← Enterprise Access Control
│   │   │   └── registry.ts  ← Source of truth for all system capabilities
│   │   ├── auth/
│   │   │   ├── session.ts   ← getAppSession() — lazy next-auth import; TEST_SESSION_JSON override
│   │   │   └── authOptions.ts ← NextAuth config (JWT strategy, CredentialsProvider)
│   │   ├── db.ts            ← Prisma client singleton
│   │   └── zodGenerator.ts  ← Dynamic Zod schema from FieldRegistry metadata
│
└── shared/                  ← Shared Contract
    └── types.ts             ← Interfaces used by both Core and Console

## Key Architectural Files
| File | Role |
|---|---|
| `AlchemaCore.ts` | Generates and executes `CREATE TABLE`, `ALTER TABLE`, etc. |
| `QueryLayer.ts` | The ONLY way to write/read data. Auto-resolves session, enforces RBAC via `AccessGuard`, injects RLS context via `TransactionContext`, and writes Audit Logs — all atomically. |
| `AccessGuard.ts` | Enforces Object-Level Permissions. Auto-extracts JWT role from session; `SUPER_ADMIN` fast-path bypasses DB lookup entirely. |
| `TransactionContext.ts` | Wraps every DB call in a transaction injected with `app.current_user_id` and `app.current_tenant_id` to activate PostgreSQL RLS policies. `resolvedRole` correctly hoisted for `finally`-block safety. |
| `session.ts` | `getAppSession()` — lazy-loads `next-auth` so it never fails in CLI/Docker contexts. Supports `TEST_SESSION_JSON` env-var override for integration tests. |
| `authOptions.ts` | NextAuth config: JWT strategy, INIDOS `CredentialsProvider` (bcrypt). Callbacks inject `tenantId`, `role`, and `teams` array into JWT token. |
| `ConnectionManager.ts` | Abstracts Postgres connection; enables switching to Database-per-tenant without touching business logic. |
| `TranslatorLayer.ts` | High-level API ensuring Metadata and Database stay in sync. |
| `FieldRegistry.ts` | Allows adding new field types (e.g., 'Signature', 'Address') without touching core logic. |
| `test-user-api.ts` | Integration testing for `/api/users/me` and `/api/tenant/users` ensuring proper session and provisioning RBAC. |
| `registry.ts` | **Hybrid Permission System**: Definitive list of platform capabilities (e.g., `system.users.manage`). Used for recursive filtering in `/api/console/config`. |


## CLI Tool Operations
```bash
# provision initial tenant
bun src/cli/inidos-cli.ts tenant:create "Ignite Idea" admin@igniteidea.ai
bun src/cli/inidos-cli.ts tenant:list
bun src/cli/inidos-cli.ts db:clean
bun src/cli/inidos-cli.ts db:check
```

## Development & Testing with Docker
INIDOS Core uses Docker Compose to provide a unified development and testing environment.

### 1. Start Development Environment
```bash
docker compose up --build
```
This starts **PostgreSQL** (port 5433) and the **Next.js/Bun API** (port 3000) with hot-reloading.

### 2. Database Synchronization
For formal schema changes:
```bash
docker compose exec app bun x prisma migrate dev --name <migration_name>
```

For rapid prototyping (development only):
```bash
docker compose exec app bun x prisma db push
```

### 3. Generating Prisma Client
Ensure TypeScript types are up to date after schema changes:
```bash
docker compose exec app bun x prisma generate
```

### 4. Running Integration Tests
```bash
docker compose exec app bun run tests/test-security.ts
docker compose exec app bun run tests/test-engine.ts
docker compose exec app bun run tests/test-user-api.ts
```

### 4. CLI Access
```bash
docker compose exec app bun run cli tenant:list
```

## Future Constraint: PWA Offline-First Architecture (DO NOT IMPLEMENT YET)
> **See full spec:** [ROADMAP.md — Phase 4](file:///Users/asana/Repo/INIDOS/docs/ROADMAP.md)

The following constraints are **pre-declared** to prevent architectural decisions today that would conflict with offline sync in the future. AI agents MUST be aware of these when touching data models, API design, or record IDs.

| Constraint | Rule |
|---|---|
| **Primary Keys** | The database MUST NOT be the sole ID generator. Client-generated UUIDv4 IDs MUST be accepted on all `dynamic` record endpoints. |
| **`updatedAt` Field** | Must be **writable by the client** during sync. The API must allow the client to supply `updatedAt` when flushing the SyncQueue. |
| **Conflict Resolution** | `AlchemaCore` will implement **Last Write Wins (LWW)**: `clientUpdatedAt > serverUpdatedAt` → apply; otherwise → reject and return current server state. |
| **SyncQueue Protocol** | Offline mutations are queued client-side and pushed sequentially. The API must handle idempotent `CREATE` operations (i.e., inserting a record whose UUID already exists must be a no-op, not an error). |
