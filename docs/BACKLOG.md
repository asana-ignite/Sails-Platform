# Project Backlog: KLAO (klao.app)

## Phase 1: Core Engine & Metadata (100% Complete)
- [x] Initialize Next.js App Router project.
- [x] Setup Metadata Layer (Prisma).
- [x] Implement `AlchemaCore` Engine (SQL Generation).
- [x] Implement Plugin Architecture (`FieldRegistry`).
- [x] Implement `TranslatorLayer` (Metadata to DB Sync).
- [x] Implement Metadata CRUD API Routes.
    - [x] POST `/api/metadata/objects` (Create Table)
    - [x] POST `/api/metadata/fields` (Add Field)
    - [x] GET `/api/metadata/schema` (Fetch Full Schema)

## Phase 2: Dynamic Validation & Logic (70% Complete)
- [x] Database-level CHECK constraints implementation.
- [x] Dynamic Zod Schema Generator via `FieldRegistry` plugins.
- [ ] Logic for complex validation rules (Regex, Range, Enum plugins).
- [x] Interceptor-based Audit Trails within Database Transactions (`QueryLayer.ts`).

## Phase 3: Dynamic UI Layer → KLAO Console (100% Complete)
- [x] **Schema Provider**: Integrated into Admin UI components.
- [x] **Dynamic Form Engine**: Component that generates forms from Zod schemas.
- [x] **Dynamic Data Table**: Component that displays table data with server-side filtering/sorting.
- [x] **Field Components**: Specialized inputs (Select, Date, etc.) implemented in Admin UI.
- [x] **Migration**: Decoupled UI into `klao-console/` project.
- [x] **Dynamic Metadata Integration**:
    - [x] Implemented hierarchical `ConsoleApp` and `ConsoleMenu` database models.
    - [x] Created `ConsoleProvider` context for global navigation state.
    - [x] Integrated dynamic icon rendering via `DynamicIcon`.
    - [x] Implemented App Switcher with immediate sidebar sync.
- [x] **SPA Transition**:
    - [x] Migrated to `react-router-dom` with `<NavLink>`.
    - [x] Implemented dynamic entity routing via `/table/:tableName`.
    - [x] Applied `React.lazy()` and `Suspense` for all pages.
    - [x] Added premium `LoadingScreen` and `Spinner` components.
- [x] **Console Metadata APIs (Full CRUD)**:
    - [x] `POST /api/console/apps`: Dynamic app creation.
    - [x] `GET/PATCH/DELETE /api/console/apps/[id]`: Full app management.
    - [x] `POST /api/console/menus`: Dynamic menu/nav creation.
    - [x] `GET/PATCH/DELETE /api/console/menus/[id]`: Full nav management.

## Phase 4: Multi-Tenancy & Security (100% Complete)
- [x] Tenant metadata definition.
- [x] Automated Tenant Provisioning & Deduplication (`TenantProvisioner.ts`).
- [x] Row-level security (RLS) via `TransactionContext`.
- [x] Relation Fields & Foreign Keys constraint management.
- [x] `ConnectionManager` abstraction for future database-per-tenant migration.
- [x] **Folder Structure Preparation**: Created auth logic directories.
- [x] **Auth Schema Definition (Prisma)**: Updated `prisma/schema.prisma`.
- [x] **API Surface Expansion**:
    - [x] `POST /api/tenant/users`: Endpoint for Tenant Admins to provision new users.
    - [x] `GET /api/users/me`: Endpoint to fetch current user's session, tenant, and permissions.
- [x] **Security Layer Integration**: Finalized Auth.js bridge, RBAC/RLS plumbing, and QueryLayer atomic transactions.

## Phase 5: Verification & Polish (90% Complete)
- [x] Unit tests for `AlchemaCore` engine logic (`test-engine.ts`). Updated to match current `QueryLayer` API signatures.
- [x] End-to-End integration test (Metadata Change → DB Sync) (`test-translator.ts`).
- [x] **Security integration test suite** (`test-security.ts`) — 7 scenarios, all passing.
- [x] **User Management API Tests** (`test-user-api.ts`) — Verified /me and /tenant/users.
- [x] Transition Runtime Environment to **Bun** (native execution & binary compilation).
- [x] **Docker-based Dev Environment**: Implemented `Dockerfile` and `docker-compose.yml` for unified development and testing.
- [ ] Performance benchmarking (DDL speed vs Metadata size).
- [x] Decouple UI into **KLAO Console** (`/klao-console`) project.
- [x] Generate `shared/types.ts` API contract for KLAO Console.
- [x] Documentation and Deployment.
- [x] **Refactoring (Profile → Team)**: Successfully renamed all references to Profile to Team across schema, DB, and code for better enterprise alignment. All security tests pass.

## Phase 6: Advanced Metadata & Enterprise Features (100% Complete)
- [x] **Step 1: Database & Schema (Foundation)**
    - [x] Add `requiredCapability` to `ConsoleApp` and `ConsoleMenu` models.
    - [x] Implement `SystemPermission` model for Team-Capability mapping.
    - [x] Run Prisma migration and regenerate client.
- [x] **Step 2: Backend Security Layer (Logic)**
    - [x] Implement `hasCapability` security utility.
    - [x] Update `GET /api/console/config` with dynamic capability filtering.
    - [x] Integrate capability checks into `AccessGuard` middleware.
- [x] **Step 3: API Surface (Interface)**
    - [x] Create `GET /api/console/permissions` (Registry exposure).
    - [x] Create CRUD endpoints for `SystemPermission` assignments.
- [x] **Step 4: Automated Provisioning (Content)**
    - [x] Define "Settings & Admin" metadata structure JSON.
    - [x] Update `TenantProvisioner` for automated system app injection.
    - [x] Provision "Settings & Admin" for the Acme tenant.
- [x] **Step 5: Frontend Integration (Experience)**
    - [x] Create Admin UI route stubs in `klao-console`.
    - [x] Implement Permission Toggle component in Admin settings.
## Phase 7: Multi-Team & Enterprise Security (100% Complete)
- [x] **N:M User-Team Relationship**: Migrated from 1:N to Many-to-Many join table (`UserTeam`).
- [x] **Active Team Context**: Implemented `activeTeamId` in session and `app.current_team_id` in Postgres.
- [x] **Team-Level Ownership**: Introduced `owner_team_id` to dynamic tables.
- [x] **Hardened Tenant Isolation**: Updated RLS policies to prevent cross-tenant leaks for administrative users.
- [x] **Additive Permission Model**: `AccessGuard` now aggregates capabilities across all team memberships.
- [x] **System Admin Fast-Path**: Integrated `is_system_admin` check into database-level RLS policies.
