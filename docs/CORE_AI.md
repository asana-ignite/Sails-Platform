# KLAO Core — Headless CRM Engine

## Product Identity
- **Product Name**: KLAO (pronounced "คลาว" / "cloud")
- **Backronym**: "Key Leads, Orders & Activities" or "Keep Leads Organized & Aligned"
- **Domain**: `klao.app`
- **Backend Project**: **KLAO Core** (this repository — `/klao-core`)
- **Frontend Project**: **KLAO Console** (separate repository — `/klao-console`, developed as a PWA and ready for offline usage)

## Project Overview
KLAO Core is a high-performance, multi-tenant No-Code CRM engine built with Bun, TypeScript, and PostgreSQL. It operates as a completely **Headless Backend API** — no UI code exists in this project. The frontend (KLAO Console) is fully decoupled. The system enables tenants to define custom data structures (Tables and Fields) which are dynamically translated into native PostgreSQL tables in real-time.

## Project Documentation
| File | Purpose |
|---|---|
| **[AI.md](AI.md)** | Main architectural overview and system entry point for developers/AI. |
| **[BACKLOG.md](BACKLOG.md)** | Tactical To-Do list. Contains specific tasks, bugs, and feature progress. |
| **[ROADMAP.md](ROADMAP.md)** | Strategic high-level vision. Outlines the long-term security and isolation phases. |
| **[DATABASE.md](DATABASE.md)** | Deep dive into the schema-per-tenant isolation and DDL/DML strategies. |
| **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** | Detailed REST API reference for metadata and dynamic data endpoints. |

## Terminology
| KLAO Term | What It Means |
|---|---|
| **Table** | A dynamic data structure defined by the tenant (e.g., "Leads"). Prisma model: `TableDefinition`. |
| **Field** | A column within a Table (e.g., "Email"). Prisma model: `FieldDefinition`. |
| **Tenant** | A customer organization. Owns a dedicated PostgreSQL schema (e.g., `tenant_acme`). |
| **Console App** | A high-level application entry for the App Switcher. Prisma model: `ConsoleApp`. |
| **Console Menu** | A navigation item in the Sidebar, potentially nested. Prisma model: `ConsoleMenu`. |

## API Endpoints (KLAO Core)
The following key endpoints provide the UI configuration and dynamic data necessary for the **KLAO Console** frontend.

### UI Metadata
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/console/config` | Fetches the hierarchical Apps and Menus for the authenticated tenant. **Development Fallback**: Uses `DEFAULT_TENANT_ID` env-var if no session is present. |

### Metadata Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/metadata/objects` | Lists all defined Tables for the tenant. |
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
/Users/asana/KLAO/klao-core/
├── prisma/                  ← Metadata Definition
│   ├── schema.prisma        ← The "Schema of Schemas" — all models in @@schema("core")
│   └── migrations/          ← Applied migrations (auth_schema_core)
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
│   │   └── klao-cli.ts      ← Script for provisioning, cleanup, and status checks
│   │
│   ├── core/
│   │   ├── engine/          ← The Heart of KLAO
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

│       │   ├── session.ts   ← getAppSession() — lazy next-auth import; TEST_SESSION_JSON override
│       │   └── authOptions.ts ← NextAuth config (JWT strategy, CredentialsProvider)
│       ├── db.ts            ← Prisma client singleton
│       └── zodGenerator.ts  ← Dynamic Zod schema from FieldRegistry metadata
│
├── shared/                  ← Shared Contract
│   └── types.ts             ← Interfaces used by both Core and Console
│
└── test-*.ts                ← Integration test scripts (run via Docker + Bun)
    ├── test-engine.ts       ← AlchemaCore DDL + RLS + Audit
    ├── test-translator.ts   ← Metadata ↔ DB sync
    ├── test-provisioner.ts  ← TenantProvisioner modes
    ├── test-validation.ts   ← Zod + DB CHECK constraints
    ├── test-security.ts     ← Security pipeline (8 scenarios — all passing)
    └── test-user-api.ts     ← User & Provisioning APIs (Session + RBAC)

## Key Architectural Files
| File | Role |
|---|---|
| `AlchemaCore.ts` | Generates and executes `CREATE TABLE`, `ALTER TABLE`, etc. |
| `QueryLayer.ts` | The ONLY way to write/read data. Auto-resolves session, enforces RBAC via `AccessGuard`, injects RLS context via `TransactionContext`, and writes Audit Logs — all atomically. |
| `AccessGuard.ts` | Enforces Object-Level Permissions. Auto-extracts JWT role from session; `SUPER_ADMIN` fast-path bypasses DB lookup entirely. |
| `TransactionContext.ts` | Wraps every DB call in a transaction injected with `app.current_user_id` and `app.current_tenant_id` to activate PostgreSQL RLS policies. `resolvedRole` correctly hoisted for `finally`-block safety. |
| `session.ts` | `getAppSession()` — lazy-loads `next-auth` so it never fails in CLI/Docker contexts. Supports `TEST_SESSION_JSON` env-var override for integration tests. |
| `authOptions.ts` | NextAuth config: JWT strategy, KLAO `CredentialsProvider` (bcrypt). Callbacks inject `tenantId`, `role`, and `teams` array into JWT token. |
| `ConnectionManager.ts` | Abstracts Postgres connection; enables switching to Database-per-tenant without touching business logic. |
| `TranslatorLayer.ts` | High-level API ensuring Metadata and Database stay in sync. |
| `FieldRegistry.ts` | Allows adding new field types (e.g., 'Signature', 'Address') without touching core logic. |
| `test-user-api.ts` | Integration testing for `/api/users/me` and `/api/tenant/users` ensuring proper session and provisioning RBAC. |
| `registry.ts` | **Hybrid Permission System**: Definitive list of platform capabilities (e.g., `system.users.manage`). Used for recursive filtering in `/api/console/config`. |


## CLI Tool Operations
```bash
bun src/cli/klao-cli.ts tenant:create "Acme Corp" admin@acme.com
bun src/cli/klao-cli.ts tenant:list
bun src/cli/klao-cli.ts db:clean
bun src/cli/klao-cli.ts db:check
```

## Development & Testing with Docker
KLAO Core uses Docker Compose to provide a unified development and testing environment.

### 1. Start Development Environment
```bash
docker-compose up --build
```
This starts **PostgreSQL** (port 5432) and the **Next.js/Bun API** (port 3000) with hot-reloading.

### 2. Database Synchronization
For formal schema changes:
```bash
docker-compose exec app bun x prisma migrate dev --name <migration_name>
```

For rapid prototyping (development only):
```bash
docker-compose exec app bun x prisma db push
```

### 3. Generating Prisma Client
Ensure TypeScript types are up to date after schema changes:
```bash
docker-compose exec app bun x prisma generate
```

### 4. Running Integration Tests
```bash
docker-compose exec app bun run test-security.ts
docker-compose exec app bun run test-engine.ts
docker-compose exec app bun run test-user-api.ts
```

### 4. CLI Access
```bash
docker-compose exec app bun run cli tenant:list
```

## Future Constraint: PWA Offline-First Architecture (DO NOT IMPLEMENT YET)
> **See full spec:** [ROADMAP.md — Phase 4](file:///Users/asana/KLAO/klao-core/ROADMAP.md)

The following constraints are **pre-declared** to prevent architectural decisions today that would conflict with offline sync in the future. AI agents MUST be aware of these when touching data models, API design, or record IDs.

| Constraint | Rule |
|---|---|
| **Primary Keys** | The database MUST NOT be the sole ID generator. Client-generated UUIDv4 IDs MUST be accepted on all `dynamic` record endpoints. |
| **`updatedAt` Field** | Must be **writable by the client** during sync. The API must allow the client to supply `updatedAt` when flushing the SyncQueue. |
| **Conflict Resolution** | `AlchemaCore` will implement **Last Write Wins (LWW)**: `clientUpdatedAt > serverUpdatedAt` → apply; otherwise → reject and return current server state. |
| **SyncQueue Protocol** | Offline mutations are queued client-side and pushed sequentially. The API must handle idempotent `CREATE` operations (i.e., inserting a record whose UUID already exists must be a no-op, not an error). |
